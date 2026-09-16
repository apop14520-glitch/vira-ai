"""Repository contracts for replacing SQLite without changing the domain."""

from datetime import datetime
from typing import Protocol

from app.modules.identity.domain import AdminCredential, AdminSession


class CredentialRepository(Protocol):
    """Persistence operations required by the administrative credential service."""

    def get_credential(self, username: str) -> AdminCredential | None:
        """Return one credential by its normalized username."""

    def get_any_credential(self) -> AdminCredential | None:
        """Return an existing administrative credential, if any."""

    def create_initial_credential(self, credential: AdminCredential) -> bool:
        """Atomically insert the credential only when none exists."""

    def save_credential(self, credential: AdminCredential) -> None:
        """Insert or update a credential record."""


class SessionRepository(Protocol):
    """Persistence operations required by opaque administrative sessions."""

    def create_session(self, session: AdminSession) -> None:
        """Persist one session hash and its bounded lifetime."""

    def get_active_session(self, token_hash: str, now: datetime) -> AdminSession | None:
        """Resolve a non-revoked, non-expired session by token hash."""

    def revoke_session(self, session_id: str, *, revoked_at: datetime) -> None:
        """Revoke one session idempotently."""

    def revoke_all_sessions(self, organization_id: str, *, revoked_at: datetime) -> int:
        """Revoke all active sessions in one organization."""
