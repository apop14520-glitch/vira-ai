"""Platform organization identity contract."""

from dataclasses import dataclass, field
from uuid import UUID, uuid4


@dataclass(frozen=True)
class Organization:
    """Minimal future tenant entity; authentication is intentionally absent."""

    id: UUID = field(default_factory=uuid4)
    name: str = ""

