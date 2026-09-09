"""AI Gateway interfaces; no vendor SDKs or network clients live here."""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class AIRequest:
    model: str
    prompt: str
    purpose: str
    organization_id: str | None = None
    timeout_seconds: float = 30.0


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

