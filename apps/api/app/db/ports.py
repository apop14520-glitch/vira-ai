"""Persistence ports used to keep storage choices replaceable."""

import sqlite3
from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class DatabaseConfig:
    """Backend-neutral database configuration."""

    url: str


class Database(Protocol):
    """Minimal lifecycle contract for database adapters."""

    config: DatabaseConfig

    def initialize(self) -> None:
        """Prepare local schema/resources."""

    def connect(self) -> sqlite3.Connection:
        """Open a short-lived unit-of-work connection."""

    def close(self) -> None:
        """Release resources held by the adapter."""
