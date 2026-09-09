"""Database adapter selection.

PostgreSQL is intentionally not implemented in this foundation. Keeping the
selection behind a factory makes that future migration explicit and localizes
the change to an adapter instead of spreading SQLite assumptions through the
application.
"""

from app.db.sqlite import SQLiteDatabase


def create_database(database_url: str) -> SQLiteDatabase:
    """Create the currently supported development database adapter."""

    if database_url.startswith("sqlite:///"):
        return SQLiteDatabase(database_url)
    if database_url.startswith(("postgresql://", "postgres://")):
        raise NotImplementedError(
            "PostgreSQL adapter is reserved for a future migration."
        )
    raise ValueError("Unsupported database URL scheme")

