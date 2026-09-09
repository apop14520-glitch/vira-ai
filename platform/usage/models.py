"""Usage tracking contract for future quotas and billing."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4


@dataclass(frozen=True)
class UsageEvent:
    id: UUID = field(default_factory=uuid4)
    organization_id: UUID | None = None
    metric: str = ""
    quantity: int = 0
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    estimated_cost: float | None = None

