"""SQLite adapter for administrative identity records."""

import sqlite3
from datetime import UTC, datetime

from app.db.ports import Database
from app.modules.identity.domain import AdminCredential, AdminSession
from app.security.passwords import PasswordHash


class SQLiteIdentityRepository:
    """Local persistence adapter behind the identity repository protocols."""

    def __init__(self, database: Database) -> None:
        self.database = database

    def initialize_schema(self) -> None:
        with self.database.connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS identity_admin_credentials (
                    username TEXT PRIMARY KEY,
                    organization_id TEXT NOT NULL,
                    password_algorithm TEXT NOT NULL,
                    password_iterations INTEGER NOT NULL,
                    password_salt_b64 TEXT NOT NULL,
                    password_digest_b64 TEXT NOT NULL,
                    password_changed_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS identity_admin_sessions (
                    session_id TEXT PRIMARY KEY,
                    token_hash TEXT NOT NULL UNIQUE,
                    username TEXT NOT NULL,
                    organization_id TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    revoked_at TEXT
                );
                CREATE INDEX IF NOT EXISTS idx_identity_sessions_expires_at
                    ON identity_admin_sessions (expires_at);
                CREATE INDEX IF NOT EXISTS idx_identity_sessions_organization
                    ON identity_admin_sessions (organization_id, revoked_at);
                """
            )

    @staticmethod
    def _timestamp(value: datetime) -> str:
        return value.astimezone(UTC).replace(microsecond=0).isoformat()

    @staticmethod
    def _datetime(value: str) -> datetime:
        parsed = datetime.fromisoformat(value)
        return parsed if parsed.tzinfo is not None else parsed.replace(tzinfo=UTC)

    @staticmethod
    def _credential_from_row(row: sqlite3.Row) -> AdminCredential:
        return AdminCredential(
            username=row["username"],
            organization_id=row["organization_id"],
            password_hash=PasswordHash(
                algorithm=row["password_algorithm"],
                iterations=int(row["password_iterations"]),
                salt_b64=row["password_salt_b64"],
                digest_b64=row["password_digest_b64"],
            ),
            password_changed_at=SQLiteIdentityRepository._datetime(row["password_changed_at"]),
            updated_at=SQLiteIdentityRepository._datetime(row["updated_at"]),
        )

    @staticmethod
    def _credential_values(credential: AdminCredential) -> tuple[object, ...]:
        return (
            credential.username,
            credential.organization_id,
            credential.password_hash.algorithm,
            credential.password_hash.iterations,
            credential.password_hash.salt_b64,
            credential.password_hash.digest_b64,
            SQLiteIdentityRepository._timestamp(credential.password_changed_at),
            SQLiteIdentityRepository._timestamp(credential.updated_at),
        )

    @staticmethod
    def _session_from_row(row: sqlite3.Row) -> AdminSession:
        return AdminSession(
            session_id=row["session_id"],
            token_hash=row["token_hash"],
            username=row["username"],
            organization_id=row["organization_id"],
            created_at=SQLiteIdentityRepository._datetime(row["created_at"]),
            expires_at=SQLiteIdentityRepository._datetime(row["expires_at"]),
            revoked_at=SQLiteIdentityRepository._datetime(row["revoked_at"]) if row["revoked_at"] else None,
        )

    def get_credential(self, username: str) -> AdminCredential | None:
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT * FROM identity_admin_credentials WHERE username = ?",
                (username,),
            ).fetchone()
        return self._credential_from_row(row) if row else None

    def get_any_credential(self) -> AdminCredential | None:
        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT * FROM identity_admin_credentials LIMIT 1"
            ).fetchone()
        return self._credential_from_row(row) if row else None

    def create_initial_credential(self, credential: AdminCredential) -> bool:
        with self.database.connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            exists = connection.execute(
                "SELECT EXISTS(SELECT 1 FROM identity_admin_credentials)"
            ).fetchone()[0]
            if exists:
                return False
            connection.execute(
                """
                INSERT INTO identity_admin_credentials
                (username, organization_id, password_algorithm, password_iterations,
                 password_salt_b64, password_digest_b64, password_changed_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                self._credential_values(credential),
            )
        return True

    def save_credential(self, credential: AdminCredential) -> None:
        with self.database.connect() as connection:
            connection.execute(
                """
                INSERT INTO identity_admin_credentials
                (username, organization_id, password_algorithm, password_iterations,
                 password_salt_b64, password_digest_b64, password_changed_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(username) DO UPDATE SET
                    organization_id = excluded.organization_id,
                    password_algorithm = excluded.password_algorithm,
                    password_iterations = excluded.password_iterations,
                    password_salt_b64 = excluded.password_salt_b64,
                    password_digest_b64 = excluded.password_digest_b64,
                    password_changed_at = excluded.password_changed_at,
                    updated_at = excluded.updated_at
                """,
                self._credential_values(credential),
            )

    def create_session(self, session: AdminSession) -> None:
        with self.database.connect() as connection:
            connection.execute(
                """
                INSERT INTO identity_admin_sessions
                (session_id, token_hash, username, organization_id, created_at, expires_at, revoked_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    session.session_id,
                    session.token_hash,
                    session.username,
                    session.organization_id,
                    self._timestamp(session.created_at),
                    self._timestamp(session.expires_at),
                    self._timestamp(session.revoked_at) if session.revoked_at else None,
                ),
            )

    def get_active_session(self, token_hash: str, now: datetime) -> AdminSession | None:
        with self.database.connect() as connection:
            row = connection.execute(
                """
                SELECT * FROM identity_admin_sessions
                WHERE token_hash = ? AND revoked_at IS NULL AND expires_at > ?
                """,
                (token_hash, self._timestamp(now)),
            ).fetchone()
        return self._session_from_row(row) if row else None

    def revoke_session(self, session_id: str, *, revoked_at: datetime) -> None:
        with self.database.connect() as connection:
            connection.execute(
                """
                UPDATE identity_admin_sessions
                SET revoked_at = COALESCE(revoked_at, ?)
                WHERE session_id = ?
                """,
                (self._timestamp(revoked_at), session_id),
            )

    def revoke_all_sessions(self, organization_id: str, *, revoked_at: datetime) -> int:
        with self.database.connect() as connection:
            cursor = connection.execute(
                """
                UPDATE identity_admin_sessions
                SET revoked_at = ?
                WHERE organization_id = ? AND revoked_at IS NULL
                """,
                (self._timestamp(revoked_at), organization_id),
            )
        return cursor.rowcount
