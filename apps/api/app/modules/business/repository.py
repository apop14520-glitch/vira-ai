"""SQLite repository for company leads, with privacy-preserving audit events."""

import json
import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID, uuid4

from app.db.sqlite import SQLiteDatabase
from app.modules.business.domain import (
    BusinessSummary,
    CompanyLead,
    CompanyLeadCreate,
    LeadStatus,
    LeadStatusUpdate,
)

PURPOSE = "business_opportunity_management"
SOURCE_TYPE = "manual"


class LeadAlreadyExistsError(Exception):
    """Raised when a company/city pair already exists in an organization."""


class LeadNotFoundError(Exception):
    """Raised when a requested lead is absent from the tenant scope."""


class LeadVersionConflictError(Exception):
    """Raised when a status change is based on stale data."""


@dataclass(frozen=True)
class AuditContext:
    """Authenticated actor and request correlation for one write operation."""

    actor_id: UUID | str = "system"
    request_id: str = "system"


class SQLiteCompanyLeadRepository:
    """Local implementation; replace only this adapter for PostgreSQL later."""

    def __init__(self, database: SQLiteDatabase) -> None:
        self.database = database

    def initialize_schema(self) -> None:
        with self.database.connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS business_company_leads (
                    id TEXT PRIMARY KEY,
                    lead_number INTEGER NOT NULL,
                    organization_id TEXT NOT NULL,
                    company_name TEXT NOT NULL,
                    normalized_company_name TEXT NOT NULL,
                    segment TEXT NOT NULL,
                    city TEXT NOT NULL,
                    normalized_city TEXT NOT NULL,
                    state TEXT NOT NULL,
                    website TEXT,
                    website_status TEXT NOT NULL,
                    source TEXT NOT NULL,
                    source_type TEXT NOT NULL,
                    purpose TEXT NOT NULL,
                    status TEXT NOT NULL,
                    priority TEXT NOT NULL,
                    version INTEGER NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE (organization_id, normalized_company_name, normalized_city)
                );
                CREATE INDEX IF NOT EXISTS idx_company_leads_tenant_status
                    ON business_company_leads (organization_id, status);
                CREATE TABLE IF NOT EXISTS business_lead_number_sequences (
                    organization_id TEXT PRIMARY KEY,
                    next_number INTEGER NOT NULL
                );
                CREATE TABLE IF NOT EXISTS business_audit_events (
                    id TEXT PRIMARY KEY,
                    organization_id TEXT NOT NULL,
                    actor_id TEXT NOT NULL DEFAULT 'system',
                    request_id TEXT NOT NULL DEFAULT 'unknown',
                    action TEXT NOT NULL,
                    resource_type TEXT NOT NULL,
                    resource_id TEXT NOT NULL,
                    occurred_at TEXT NOT NULL,
                    metadata_json TEXT NOT NULL,
                    outcome TEXT NOT NULL DEFAULT 'success'
                );
                """
            )
            self._ensure_column(connection, "business_company_leads", "temperature", "TEXT NOT NULL DEFAULT 'morno'")
            self._ensure_column(connection, "business_company_leads", "external_place_id", "TEXT")
            self._ensure_column(connection, "business_company_leads", "lead_number", "INTEGER")
            self._ensure_column(connection, "business_audit_events", "actor_id", "TEXT NOT NULL DEFAULT 'system'")
            self._ensure_column(connection, "business_audit_events", "request_id", "TEXT NOT NULL DEFAULT 'unknown'")
            self._ensure_column(connection, "business_audit_events", "outcome", "TEXT NOT NULL DEFAULT 'success'")
            self._backfill_lead_numbers(connection)
            connection.execute(
                """CREATE UNIQUE INDEX IF NOT EXISTS idx_company_leads_tenant_number
                ON business_company_leads (organization_id, lead_number)"""
            )

    @staticmethod
    def _ensure_column(connection: sqlite3.Connection, table: str, column: str, definition: str) -> None:
        """Apply additive local migrations without rewriting existing development data."""

        columns = {row["name"] for row in connection.execute(f"PRAGMA table_info({table})").fetchall()}
        if column not in columns:
            connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")

    @staticmethod
    def _backfill_lead_numbers(connection: sqlite3.Connection) -> None:
        """Assign readable numbers to legacy rows without changing their UUIDs."""

        organizations = connection.execute(
            "SELECT DISTINCT organization_id FROM business_company_leads"
        ).fetchall()
        for organization in organizations:
            organization_id = organization["organization_id"]
            next_number = connection.execute(
                "SELECT COALESCE(MAX(lead_number), 0) FROM business_company_leads WHERE organization_id = ?",
                (organization_id,),
            ).fetchone()[0]
            missing_rows = connection.execute(
                """SELECT id FROM business_company_leads
                WHERE organization_id = ? AND lead_number IS NULL
                ORDER BY created_at ASC, id ASC""",
                (organization_id,),
            ).fetchall()
            for row in missing_rows:
                next_number += 1
                connection.execute(
                    "UPDATE business_company_leads SET lead_number = ? WHERE id = ?",
                    (next_number, row["id"]),
                )
            next_available = next_number + 1
            sequence = connection.execute(
                "SELECT next_number FROM business_lead_number_sequences WHERE organization_id = ?",
                (organization_id,),
            ).fetchone()
            if sequence is None:
                connection.execute(
                    "INSERT INTO business_lead_number_sequences (organization_id, next_number) VALUES (?, ?)",
                    (organization_id, next_available),
                )
            elif sequence["next_number"] < next_available:
                connection.execute(
                    "UPDATE business_lead_number_sequences SET next_number = ? WHERE organization_id = ?",
                    (next_available, organization_id),
                )

    @staticmethod
    def _next_lead_number(connection: sqlite3.Connection, organization_id: UUID) -> int:
        """Allocate a monotonic public number without reusing deleted numbers."""

        legacy_next = connection.execute(
            "SELECT COALESCE(MAX(lead_number), 0) + 1 FROM business_company_leads WHERE organization_id = ?",
            (str(organization_id),),
        ).fetchone()[0]
        connection.execute(
            "INSERT OR IGNORE INTO business_lead_number_sequences (organization_id, next_number) VALUES (?, ?)",
            (str(organization_id), legacy_next),
        )
        next_number = connection.execute(
            "SELECT next_number FROM business_lead_number_sequences WHERE organization_id = ?",
            (str(organization_id),),
        ).fetchone()[0]
        connection.execute(
            "UPDATE business_lead_number_sequences SET next_number = ? WHERE organization_id = ?",
            (next_number + 1, str(organization_id)),
        )
        return int(next_number)

    @staticmethod
    def _now() -> datetime:
        return datetime.now(UTC).replace(microsecond=0)

    @staticmethod
    def _normalized(value: str) -> str:
        return " ".join(value.casefold().split())

    @staticmethod
    def _from_row(row: sqlite3.Row) -> CompanyLead:
        return CompanyLead(
            id=UUID(row["id"]),
            lead_number=int(row["lead_number"]),
            organization_id=UUID(row["organization_id"]),
            company_name=row["company_name"],
            segment=row["segment"],
            city=row["city"],
            state=row["state"],
            website=row["website"],
            website_status=row["website_status"],
            source=row["source"],
            source_type=row["source_type"],
            purpose=row["purpose"],
            status=row["status"],
            priority=row["priority"],
            temperature=row["temperature"],
            external_place_id=row["external_place_id"],
            version=row["version"],
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )

    @staticmethod
    def _audit(
        connection: sqlite3.Connection,
        organization_id: UUID,
        action: str,
        resource_type: str,
        resource_id: UUID | str,
        metadata: dict[str, object],
        audit_context: AuditContext | None = None,
        outcome: str = "success",
    ) -> None:
        context = audit_context or AuditContext()
        request_id = context.request_id[:128] if context.request_id.isprintable() else "unknown"
        safe_metadata = {
            key: value
            for key, value in metadata.items()
            if key.casefold() not in {"api_key", "authorization", "token", "secret"}
        }
        connection.execute(
            """INSERT INTO business_audit_events
            (id, organization_id, actor_id, request_id, action, resource_type, resource_id, occurred_at, metadata_json, outcome)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                str(uuid4()),
                str(organization_id),
                str(context.actor_id),
                request_id,
                action,
                resource_type,
                str(resource_id),
                SQLiteCompanyLeadRepository._now().isoformat(),
                json.dumps(safe_metadata, ensure_ascii=False),
                outcome,
            ),
        )

    def record_audit_event(
        self,
        organization_id: UUID,
        action: str,
        resource_type: str,
        resource_id: UUID | str,
        audit_context: AuditContext,
        metadata: dict[str, object] | None = None,
        outcome: str = "success",
    ) -> None:
        """Persist a privacy-safe event for operations outside lead CRUD."""

        with self.database.connect() as connection:
            self._audit(
                connection,
                organization_id,
                action,
                resource_type,
                resource_id,
                metadata or {},
                audit_context,
                outcome,
            )

    def list(self, organization_id: UUID, status: LeadStatus | None = None, query: str | None = None) -> list[CompanyLead]:
        clauses = ["organization_id = ?"]
        values: list[str] = [str(organization_id)]
        if status:
            clauses.append("status = ?")
            values.append(status.value)
        if query and query.strip():
            clauses.append("(normalized_company_name LIKE ? OR lower(segment) LIKE ? OR normalized_city LIKE ?)")
            search = f"%{self._normalized(query)}%"
            values.extend([search, search, search])
        with self.database.connect() as connection:
            rows = connection.execute(
                f"SELECT * FROM business_company_leads WHERE {' AND '.join(clauses)} ORDER BY updated_at DESC", values
            ).fetchall()
        return [self._from_row(row) for row in rows]

    def create(self, organization_id: UUID, data: CompanyLeadCreate, audit_context: AuditContext | None = None) -> CompanyLead:
        lead_id = uuid4()
        now = self._now()
        try:
            with self.database.connect() as connection:
                next_number = self._next_lead_number(connection, organization_id)
                connection.execute(
                    """INSERT INTO business_company_leads
                    (id, lead_number, organization_id, company_name, normalized_company_name, segment, city, normalized_city, state,
                     website, website_status, source, source_type, purpose, status, priority, temperature,
                     external_place_id, version, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)""",
                    (
                        str(lead_id), next_number, str(organization_id), data.company_name, self._normalized(data.company_name), data.segment,
                        data.city, self._normalized(data.city), data.state, data.website,
                        "informado" if data.website else data.website_status.value, data.source,
                        SOURCE_TYPE, PURPOSE, LeadStatus.NOVO.value, data.priority.value,
                        data.temperature.value,
                        data.external_place_id, now.isoformat(), now.isoformat(),
                    ),
                )
                self._audit(connection, organization_id, "company_lead.created", "company_lead", lead_id, {"source": data.source}, audit_context)
                row = connection.execute("SELECT * FROM business_company_leads WHERE id = ?", (str(lead_id),)).fetchone()
        except sqlite3.IntegrityError as error:
            raise LeadAlreadyExistsError from error
        return self._from_row(row)

    def delete(self, organization_id: UUID, lead_id: UUID, audit_context: AuditContext | None = None) -> None:
        """Delete one tenant-scoped lead and preserve a privacy-safe audit event."""

        with self.database.connect() as connection:
            current = connection.execute(
                "SELECT id FROM business_company_leads WHERE id = ? AND organization_id = ?",
                (str(lead_id), str(organization_id)),
            ).fetchone()
            if current is None:
                raise LeadNotFoundError
            connection.execute(
                "DELETE FROM business_company_leads WHERE id = ? AND organization_id = ?",
                (str(lead_id), str(organization_id)),
            )
            self._audit(connection, organization_id, "company_lead.deleted", "company_lead", lead_id, {}, audit_context)

    def update_status(
        self,
        organization_id: UUID,
        lead_id: UUID,
        data: LeadStatusUpdate,
        audit_context: AuditContext | None = None,
    ) -> CompanyLead:
        now = self._now()
        with self.database.connect() as connection:
            cursor = connection.execute(
                """UPDATE business_company_leads SET status = ?, version = version + 1, updated_at = ?
                WHERE id = ? AND organization_id = ? AND version = ?""",
                (data.status.value, now.isoformat(), str(lead_id), str(organization_id), data.version),
            )
            if cursor.rowcount == 0:
                current = connection.execute(
                    "SELECT id FROM business_company_leads WHERE id = ? AND organization_id = ?", (str(lead_id), str(organization_id))
                ).fetchone()
                if current is None:
                    raise LeadNotFoundError
                raise LeadVersionConflictError
            self._audit(
                connection,
                organization_id,
                "company_lead.status_updated",
                "company_lead",
                lead_id,
                {"status": data.status.value},
                audit_context,
            )
            row = connection.execute("SELECT * FROM business_company_leads WHERE id = ?", (str(lead_id),)).fetchone()
        return self._from_row(row)

    def summary(self, organization_id: UUID) -> BusinessSummary:
        counts = {status: 0 for status in LeadStatus}
        with self.database.connect() as connection:
            rows = connection.execute(
                "SELECT status, COUNT(*) AS count FROM business_company_leads WHERE organization_id = ? GROUP BY status",
                (str(organization_id),),
            ).fetchall()
        for row in rows:
            counts[LeadStatus(row["status"])] = row["count"]
        return BusinessSummary(total=sum(counts.values()), by_status=counts)
