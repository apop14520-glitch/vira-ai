"""Domain records for local administrative credentials and sessions."""

from dataclasses import dataclass
from datetime import datetime

from app.security.passwords import PasswordHash


@dataclass(frozen=True)
class AdminCredential:
    """Minimal persisted credential for one administrative identity."""

    username: str
    organization_id: str
    password_hash: PasswordHash
    password_changed_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class AdminSession:
    """Opaque session metadata; the raw browser token never belongs here."""

    session_id: str
    token_hash: str
    username: str
    organization_id: str
    created_at: datetime
    expires_at: datetime
    revoked_at: datetime | None = None
