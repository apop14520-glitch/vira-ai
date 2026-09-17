"""AI Gateway interfaces; no vendor SDKs or network clients live here."""

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Mapping, Protocol


class SafetyAction(StrEnum):
    """Decision produced by a pre- or post-generation safety check."""

    ALLOW = "allow"
    WARN = "warn"
    BLOCK = "block"


@dataclass(frozen=True)
class SafetyVerdict:
    """Auditable safety decision without retaining the inspected content."""

    action: SafetyAction
    category: str
    confidence: float
    rule_code: str | None = None


@dataclass(frozen=True)
class AIRequest:
    model: str
    prompt: str
    purpose: str
    organization_id: str | None = None
    timeout_seconds: float = 30.0
    request_id: str | None = None
    source_ids: tuple[str, ...] = ()
    metadata: Mapping[str, str] = field(default_factory=dict)


@dataclass(frozen=True)
class AIResponse:
    text: str
    provider: str
    model: str
    input_tokens: int | None = None
    output_tokens: int | None = None
    estimated_cost: float | None = None


class AIProvider(Protocol):
    name: str

    def generate(self, request: AIRequest) -> AIResponse:
        """Execute a provider request through a future adapter."""


class ModelRouter(Protocol):
    def select(self, request: AIRequest) -> AIProvider:
        """Select a provider/model using future routing and fallback rules."""
