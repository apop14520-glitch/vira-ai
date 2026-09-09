"""Domain event contracts for future queues and workers."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from uuid import UUID, uuid4


@dataclass(frozen=True)
class DomainEvent:
    event_id: UUID = field(default_factory=uuid4)
    organization_id: UUID | None = None
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass(frozen=True)
class LeadCreated(DomainEvent):
    pass


@dataclass(frozen=True)
class CompanyAnalyzed(DomainEvent):
    pass


@dataclass(frozen=True)
class SiteGenerationRequested(DomainEvent):
    pass


@dataclass(frozen=True)
class AgentExecutionStarted(DomainEvent):
    pass


@dataclass(frozen=True)
class AgentExecutionCompleted(DomainEvent):
    pass

