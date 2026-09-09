"""Data provenance contract for future collection pipelines."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID


@dataclass(frozen=True)
class DataProvenance:
    source: str
    source_type: str
    collected_at: datetime
    updated_at: datetime | None
    purpose: str
    confidence: float | None
    organization_id: UUID | None

