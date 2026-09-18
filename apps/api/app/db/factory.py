"""Database adapter selection.

Keeping the selection behind a factory localizes storage-engine choices to
this module instead of spreading them through the application.
"""

from app.db.postgres import PostgresDatabase
from app.db.sqlite import SQLiteDatabase


def create_database(database_url: str) -> SQLiteDatabase | PostgresDatabase:
    """Create the database adapter matching the configured URL scheme."""

    if database_url.startswith("sqlite:///"):
        return SQLiteDatabase(database_url)
    if database_url.startswith(("postgresql://", "postgres://")):
        return PostgresDatabase(database_url)
    raise ValueError("Unsupported database URL scheme")

