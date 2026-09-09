"""Repository ports to keep domain rules independent of database technology."""

from typing import Generic, Protocol, TypeVar
from uuid import UUID


EntityT = TypeVar("EntityT")


class Repository(Protocol, Generic[EntityT]):
    def get(self, entity_id: UUID) -> EntityT | None:
        """Retrieve one entity by UUID."""

    def save(self, entity: EntityT) -> EntityT:
        """Persist one entity without leaking SQL into domain services."""

