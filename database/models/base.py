"""Backend-neutral entity base for future persistence models."""

from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass
class Entity:
    id: UUID = field(default_factory=uuid4)


@dataclass
class TenantEntity(Entity):
    """Entity base for records logically isolated by organization."""

    organization_id: UUID = field(default_factory=uuid4)
