"""SQLite adapter for local development only."""

import sqlite3
from pathlib import Path

from app.db.ports import DatabaseConfig


class SQLiteDatabase:
    """Small local adapter behind the database port.

    Domain code should depend on ports and repositories, not on this class.
    A future PostgreSQL adapter can implement the same lifecycle contract.
    """

    def __init__(self, url: str) -> None:
        if not url.startswith("sqlite:///"):
            raise ValueError("SQLiteDatabase requires a sqlite:/// URL")
        self.config = DatabaseConfig(url=url)
        self._connection: sqlite3.Connection | None = None

    @property
    def path(self) -> Path:
        """Resolve the filesystem path represented by a local SQLite URL."""

        return Path(self.config.url.removeprefix("sqlite:///"))

    def initialize(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(self.path)

    def connect(self) -> sqlite3.Connection:
        """Open an isolated SQLite connection for a repository operation.

        Repositories own their short-lived connections so HTTP requests do not
        share a mutable cursor. PostgreSQL can later provide the equivalent
        unit-of-work behaviour behind the same repository ports.
        """

        self.path.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(self.path)
        connection.row_factory = sqlite3.Row
        return connection

    def close(self) -> None:
        if self._connection is not None:
            self._connection.close()
            self._connection = None
