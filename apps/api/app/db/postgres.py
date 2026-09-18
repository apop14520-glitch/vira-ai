"""PostgreSQL adapter that speaks the same connection dialect as SQLiteDatabase.

Repositories were written against sqlite3's placeholder style (``?``), its
``executescript``/``PRAGMA table_info`` idioms, and rows that support both
``row["col"]`` and ``row[0]`` access. Rather than forking every repository
into SQLite/Postgres variants, this adapter translates that dialect onto
psycopg so the existing repository code runs unchanged against Postgres.
"""

import re
from types import TracebackType

import psycopg
from psycopg.rows import Row, RowMaker

from app.db.ports import DatabaseConfig

_PRAGMA_TABLE_INFO = re.compile(r"PRAGMA\s+table_info\((\w+)\)", re.IGNORECASE)


class _CompatRow:
    """Row supporting both column-name and positional access, like sqlite3.Row."""

    __slots__ = ("_columns", "_values")

    def __init__(self, columns: list[str], values: tuple[object, ...]) -> None:
        self._columns = columns
        self._values = values

    def __getitem__(self, key: object) -> object:
        if isinstance(key, int):
            return self._values[key]
        return self._values[self._columns.index(key)]

    def __iter__(self):
        return iter(self._values)

    def __len__(self) -> int:
        return len(self._values)

    def keys(self) -> list[str]:
        return list(self._columns)


def _compat_row_factory(cursor: "psycopg.Cursor[Row]") -> RowMaker[_CompatRow]:
    columns = [column.name for column in (cursor.description or [])]

    def make_row(values: tuple[object, ...]) -> _CompatRow:
        return _CompatRow(columns, values)

    return make_row


def _translate(sql: str) -> str:
    """Rewrite sqlite3-flavoured SQL into the Postgres equivalent."""

    stripped = sql.strip()
    if stripped.upper() == "BEGIN IMMEDIATE":
        # psycopg connections already run inside an implicit transaction
        # (autocommit is off by default), so there is nothing else to start.
        return "SELECT 1 WHERE FALSE"

    match = _PRAGMA_TABLE_INFO.search(sql)
    if match:
        table = match.group(1)
        return (
            "SELECT column_name AS name FROM information_schema.columns "
            f"WHERE table_name = '{table}'"
        )

    return sql.replace("?", "%s")


class _CompatConnection:
    """Wraps a psycopg connection with sqlite3.Connection-shaped methods."""

    def __init__(self, connection: "psycopg.Connection[_CompatRow]") -> None:
        self._connection = connection

    def execute(self, sql: str, params: tuple[object, ...] = ()) -> "psycopg.Cursor[_CompatRow]":
        cursor = self._connection.cursor()
        cursor.execute(_translate(sql), params)
        return cursor

    def executescript(self, script: str) -> None:
        with self._connection.cursor() as cursor:
            cursor.execute(script)

    def commit(self) -> None:
        self._connection.commit()

    def rollback(self) -> None:
        self._connection.rollback()

    def close(self) -> None:
        self._connection.close()

    def __enter__(self) -> "_CompatConnection":
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_value: BaseException | None,
        traceback: TracebackType | None,
    ) -> None:
        if exc_type is None:
            self._connection.commit()
        else:
            self._connection.rollback()
        self._connection.close()


class PostgresDatabase:
    """Postgres adapter behind the same lifecycle contract as SQLiteDatabase."""

    def __init__(self, url: str) -> None:
        if not url.startswith(("postgresql://", "postgres://")):
            raise ValueError("PostgresDatabase requires a postgresql:// URL")
        self.config = DatabaseConfig(url=url)

    def initialize(self) -> None:
        self.connect().close()

    def connect(self) -> _CompatConnection:
        """Open a short-lived connection for a repository operation."""

        connection = psycopg.connect(self.config.url, row_factory=_compat_row_factory)
        return _CompatConnection(connection)

    def close(self) -> None:
        """No pooled/shared connection is kept open between requests."""
