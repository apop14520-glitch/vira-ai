"""SQLite repository for the Concursos question bank and quiz attempts."""

import json
import random
import sqlite3
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID, uuid4

from app.db.ports import Database
from app.modules.concursos.domain import (
    AuditEvent,
    ConcursosSummary,
    Question,
    QuestionCreate,
    QuestionPublic,
    Topic,
    TopicCreate,
)


class TopicNotFoundError(Exception):
    """Raised when a requested topic is absent from the tenant scope."""


class QuestionNotFoundError(Exception):
    """Raised when a requested question is absent from the tenant scope."""


@dataclass(frozen=True)
class AuditContext:
    """Authenticated actor and request correlation for one write operation."""

    actor_id: UUID | str = "system"
    request_id: str = "system"


class SQLiteConcursosRepository:
    """Local implementation; replace only this adapter for PostgreSQL later."""

    def __init__(self, database: Database) -> None:
        self.database = database

    def initialize_schema(self) -> None:
        with self.database.connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS concursos_topics (
                    id TEXT PRIMARY KEY,
                    organization_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    normalized_name TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL,
                    UNIQUE (organization_id, normalized_name)
                );
                CREATE TABLE IF NOT EXISTS concursos_questions (
                    id TEXT PRIMARY KEY,
                    organization_id TEXT NOT NULL,
                    topic_id TEXT NOT NULL,
                    statement TEXT NOT NULL,
                    option_a TEXT NOT NULL,
                    option_b TEXT NOT NULL,
                    option_c TEXT NOT NULL,
                    option_d TEXT NOT NULL,
                    correct_option TEXT NOT NULL,
                    explanation TEXT NOT NULL DEFAULT '',
                    difficulty TEXT NOT NULL DEFAULT 'media',
                    source TEXT NOT NULL DEFAULT 'manual',
                    created_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_concursos_questions_topic
                    ON concursos_questions (organization_id, topic_id);
                CREATE TABLE IF NOT EXISTS concursos_audit_events (
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
            self._ensure_column(connection, "concursos_questions", "option_e", "TEXT")

    @staticmethod
    def _ensure_column(connection: sqlite3.Connection, table: str, column: str, definition: str) -> None:
        """Apply additive local migrations without rewriting existing production data."""

        # table/column/definition are always literal strings passed from initialize_schema()
        # in this same file, never user input; SQLite has no placeholder syntax for
        # identifiers anyway, so string formatting is the standard way to run additive DDL.
        columns = {row["name"] for row in connection.execute(f"PRAGMA table_info({table})").fetchall()}  # nosemgrep: python.lang.security.audit.formatted-sql-query.formatted-sql-query,python.sqlalchemy.security.sqlalchemy-execute-raw-query.sqlalchemy-execute-raw-query
        if column not in columns:
            connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")  # nosemgrep: python.lang.security.audit.formatted-sql-query.formatted-sql-query,python.sqlalchemy.security.sqlalchemy-execute-raw-query.sqlalchemy-execute-raw-query

    @staticmethod
    def _now() -> datetime:
        return datetime.now(UTC).replace(microsecond=0)

    @staticmethod
    def _normalized(value: str) -> str:
        return " ".join(value.casefold().split())

    @staticmethod
    def _topic_from_row(row: sqlite3.Row, question_count: int) -> Topic:
        return Topic(
            id=UUID(row["id"]),
            organization_id=UUID(row["organization_id"]),
            name=row["name"],
            description=row["description"],
            question_count=question_count,
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    @staticmethod
    def _question_from_row(row: sqlite3.Row) -> Question:
        return Question(
            id=UUID(row["id"]),
            organization_id=UUID(row["organization_id"]),
            topic_id=UUID(row["topic_id"]),
            statement=row["statement"],
            option_a=row["option_a"],
            option_b=row["option_b"],
            option_c=row["option_c"],
            option_d=row["option_d"],
            option_e=row["option_e"],
            correct_option=row["correct_option"],
            explanation=row["explanation"],
            difficulty=row["difficulty"],
            source=row["source"],
            created_at=datetime.fromisoformat(row["created_at"]),
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
            """INSERT INTO concursos_audit_events
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
                SQLiteConcursosRepository._now().isoformat(),
                json.dumps(safe_metadata, ensure_ascii=False),
                outcome,
            ),
        )

    def list_audit_events(self, organization_id: UUID, limit: int = 50) -> list[AuditEvent]:
        bounded_limit = min(max(limit, 1), 200)
        with self.database.connect() as connection:
            rows = connection.execute(
                """SELECT * FROM concursos_audit_events WHERE organization_id = ?
                ORDER BY occurred_at DESC LIMIT ?""",
                (str(organization_id), bounded_limit),
            ).fetchall()
        return [
            AuditEvent(
                id=UUID(row["id"]),
                actor_id=row["actor_id"],
                action=row["action"],
                resource_type=row["resource_type"],
                resource_id=row["resource_id"],
                occurred_at=datetime.fromisoformat(row["occurred_at"]),
                outcome=row["outcome"],
                metadata=json.loads(row["metadata_json"]),
            )
            for row in rows
        ]

    def _question_count(self, connection: sqlite3.Connection, organization_id: UUID, topic_id: UUID) -> int:
        return connection.execute(
            "SELECT COUNT(*) FROM concursos_questions WHERE organization_id = ? AND topic_id = ?",
            (str(organization_id), str(topic_id)),
        ).fetchone()[0]

    def list_topics(self, organization_id: UUID) -> list[Topic]:
        with self.database.connect() as connection:
            rows = connection.execute(
                "SELECT * FROM concursos_topics WHERE organization_id = ? ORDER BY name ASC",
                (str(organization_id),),
            ).fetchall()
            return [
                self._topic_from_row(row, self._question_count(connection, organization_id, UUID(row["id"])))
                for row in rows
            ]

    def create_topic(self, organization_id: UUID, data: TopicCreate, audit_context: AuditContext | None = None) -> Topic:
        topic_id = uuid4()
        now = self._now()
        with self.database.connect() as connection:
            connection.execute(
                """INSERT INTO concursos_topics (id, organization_id, name, normalized_name, description, created_at)
                VALUES (?, ?, ?, ?, ?, ?)""",
                (str(topic_id), str(organization_id), data.name, self._normalized(data.name), data.description, now.isoformat()),
            )
            self._audit(connection, organization_id, "topic.created", "concursos_topic", topic_id, {"name": data.name}, audit_context)
            row = connection.execute("SELECT * FROM concursos_topics WHERE id = ?", (str(topic_id),)).fetchone()
        return self._topic_from_row(row, 0)

    def delete_topic(self, organization_id: UUID, topic_id: UUID, audit_context: AuditContext | None = None) -> None:
        with self.database.connect() as connection:
            current = connection.execute(
                "SELECT id FROM concursos_topics WHERE id = ? AND organization_id = ?",
                (str(topic_id), str(organization_id)),
            ).fetchone()
            if current is None:
                raise TopicNotFoundError
            connection.execute(
                "DELETE FROM concursos_questions WHERE topic_id = ? AND organization_id = ?",
                (str(topic_id), str(organization_id)),
            )
            connection.execute(
                "DELETE FROM concursos_topics WHERE id = ? AND organization_id = ?",
                (str(topic_id), str(organization_id)),
            )
            self._audit(connection, organization_id, "topic.deleted", "concursos_topic", topic_id, {}, audit_context)

    def list_questions(self, organization_id: UUID, topic_id: UUID | None = None) -> list[Question]:
        clauses = ["organization_id = ?"]
        values: list[str] = [str(organization_id)]
        if topic_id is not None:
            clauses.append("topic_id = ?")
            values.append(str(topic_id))
        with self.database.connect() as connection:
            # Only the fixed clause strings above (never user input) are interpolated into the
            # query text; every actual value goes through `values` as a bound `?` parameter.
            rows = connection.execute(  # nosemgrep: python.sqlalchemy.security.sqlalchemy-execute-raw-query.sqlalchemy-execute-raw-query
                f"SELECT * FROM concursos_questions WHERE {' AND '.join(clauses)} ORDER BY created_at DESC", values
            ).fetchall()
        return [self._question_from_row(row) for row in rows]

    def create_question(
        self, organization_id: UUID, data: QuestionCreate, audit_context: AuditContext | None = None
    ) -> Question:
        with self.database.connect() as connection:
            topic = connection.execute(
                "SELECT id FROM concursos_topics WHERE id = ? AND organization_id = ?",
                (str(data.topic_id), str(organization_id)),
            ).fetchone()
            if topic is None:
                raise TopicNotFoundError
            question_id = uuid4()
            now = self._now()
            connection.execute(
                """INSERT INTO concursos_questions
                (id, organization_id, topic_id, statement, option_a, option_b, option_c, option_d, option_e,
                 correct_option, explanation, difficulty, source, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    str(question_id), str(organization_id), str(data.topic_id), data.statement,
                    data.option_a, data.option_b, data.option_c, data.option_d, data.option_e,
                    data.correct_option.value, data.explanation, data.difficulty.value, data.source,
                    now.isoformat(),
                ),
            )
            self._audit(
                connection, organization_id, "question.created", "concursos_question", question_id,
                {"topic_id": str(data.topic_id), "difficulty": data.difficulty.value}, audit_context,
            )
            row = connection.execute("SELECT * FROM concursos_questions WHERE id = ?", (str(question_id),)).fetchone()
        return self._question_from_row(row)

    def delete_question(self, organization_id: UUID, question_id: UUID, audit_context: AuditContext | None = None) -> None:
        with self.database.connect() as connection:
            current = connection.execute(
                "SELECT id FROM concursos_questions WHERE id = ? AND organization_id = ?",
                (str(question_id), str(organization_id)),
            ).fetchone()
            if current is None:
                raise QuestionNotFoundError
            connection.execute(
                "DELETE FROM concursos_questions WHERE id = ? AND organization_id = ?",
                (str(question_id), str(organization_id)),
            )
            self._audit(connection, organization_id, "question.deleted", "concursos_question", question_id, {}, audit_context)

    def start_quiz(self, organization_id: UUID, topic_id: UUID, quantity: int) -> list[QuestionPublic]:
        with self.database.connect() as connection:
            topic = connection.execute(
                "SELECT id FROM concursos_topics WHERE id = ? AND organization_id = ?",
                (str(topic_id), str(organization_id)),
            ).fetchone()
            if topic is None:
                raise TopicNotFoundError
            rows = connection.execute(
                "SELECT * FROM concursos_questions WHERE organization_id = ? AND topic_id = ?",
                (str(organization_id), str(topic_id)),
            ).fetchall()
        sample = random.sample(rows, k=min(quantity, len(rows)))
        return [self._question_public_from_row(row) for row in sample]

    @staticmethod
    def _question_public_from_row(row: sqlite3.Row) -> QuestionPublic:
        return QuestionPublic(
            id=UUID(row["id"]),
            topic_id=UUID(row["topic_id"]),
            statement=row["statement"],
            option_a=row["option_a"],
            option_b=row["option_b"],
            option_c=row["option_c"],
            option_d=row["option_d"],
            option_e=row["option_e"],
            difficulty=row["difficulty"],
        )

    def draw_questions(
        self, organization_id: UUID, topic_ids: list[UUID], quantity: int
    ) -> list[QuestionPublic]:
        """Draw a random set of questions, optionally restricted to some topics."""

        with self.database.connect() as connection:
            if topic_ids:
                rows = []
                for topic_id in dict.fromkeys(topic_ids):
                    rows.extend(
                        connection.execute(
                            "SELECT * FROM concursos_questions WHERE organization_id = ? AND topic_id = ?",
                            (str(organization_id), str(topic_id)),
                        ).fetchall()
                    )
            else:
                rows = connection.execute(
                    "SELECT * FROM concursos_questions WHERE organization_id = ?",
                    (str(organization_id),),
                ).fetchall()
        sample = random.sample(rows, k=min(quantity, len(rows)))
        return [self._question_public_from_row(row) for row in sample]

    def check_answer(
        self, organization_id: UUID, question_id: UUID, selected_option: str
    ) -> dict[str, object]:
        """Grade a single answer so study mode can show feedback right away."""

        with self.database.connect() as connection:
            row = connection.execute(
                "SELECT * FROM concursos_questions WHERE id = ? AND organization_id = ?",
                (str(question_id), str(organization_id)),
            ).fetchone()
        if row is None:
            raise QuestionNotFoundError
        return {
            "question_id": question_id,
            "selected_option": selected_option,
            "correct_option": row["correct_option"],
            "is_correct": row["correct_option"] == selected_option,
            "explanation": row["explanation"],
        }

    def grade_exam(
        self,
        organization_id: UUID,
        answers: list[tuple[UUID, str]],
        blank_question_ids: list[UUID],
        audit_context: AuditContext | None = None,
    ) -> tuple[int, int, list[dict[str, object]]]:
        """Grade an exam whose questions may come from several topics.

        Blank questions still count in the total and are returned with their answer key.
        """

        graded: list[tuple[UUID, str | None]] = [*answers, *((question_id, None) for question_id in blank_question_ids)]
        with self.database.connect() as connection:
            results: list[dict[str, object]] = []
            correct_count = 0
            for question_id, selected_option in graded:
                row = connection.execute(
                    "SELECT * FROM concursos_questions WHERE id = ? AND organization_id = ?",
                    (str(question_id), str(organization_id)),
                ).fetchone()
                if row is None:
                    raise QuestionNotFoundError
                is_correct = selected_option is not None and row["correct_option"] == selected_option
                if is_correct:
                    correct_count += 1
                results.append(
                    {
                        "question_id": question_id,
                        "selected_option": selected_option,
                        "correct_option": row["correct_option"],
                        "is_correct": is_correct,
                        "explanation": row["explanation"],
                    }
                )
            self._audit(
                connection, organization_id, "exam.completed", "concursos_exam", organization_id,
                {"total": len(graded), "correct": correct_count, "blank": len(blank_question_ids)}, audit_context,
            )
        return len(graded), correct_count, results

    def grade_quiz(
        self,
        organization_id: UUID,
        topic_id: UUID,
        answers: list[tuple[UUID, str]],
        audit_context: AuditContext | None = None,
    ) -> tuple[int, int, list[dict[str, object]]]:
        with self.database.connect() as connection:
            results: list[dict[str, object]] = []
            correct_count = 0
            for question_id, selected_option in answers:
                row = connection.execute(
                    "SELECT * FROM concursos_questions WHERE id = ? AND organization_id = ?",
                    (str(question_id), str(organization_id)),
                ).fetchone()
                if row is None:
                    raise QuestionNotFoundError
                is_correct = row["correct_option"] == selected_option
                if is_correct:
                    correct_count += 1
                results.append(
                    {
                        "question_id": question_id,
                        "selected_option": selected_option,
                        "correct_option": row["correct_option"],
                        "is_correct": is_correct,
                        "explanation": row["explanation"],
                    }
                )
            self._audit(
                connection, organization_id, "quiz.completed", "concursos_topic", topic_id,
                {"total": len(answers), "correct": correct_count}, audit_context,
            )
        return len(answers), correct_count, results

    def summary(self, organization_id: UUID) -> ConcursosSummary:
        with self.database.connect() as connection:
            topics = connection.execute(
                "SELECT id, name FROM concursos_topics WHERE organization_id = ?", (str(organization_id),)
            ).fetchall()
            by_topic: dict[str, int] = {}
            for topic in topics:
                by_topic[topic["name"]] = self._question_count(connection, organization_id, UUID(topic["id"]))
        return ConcursosSummary(total_topics=len(topics), total_questions=sum(by_topic.values()), by_topic=by_topic)
