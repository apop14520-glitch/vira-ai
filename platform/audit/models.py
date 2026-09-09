"""Audit event contract."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any
from uuid import UUID, uuid4


@dataclass(frozen=True)
class AuditEvent:
    event_id: UUID = field(default_factory=uuid4)
    organization_id: UUID | None = None
    actor_id: UUID | None = None
    action: str = ""
    resource_type: str = ""
    resource_id: UUID | None = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict[str, Any] = field(default_factory=dict)

