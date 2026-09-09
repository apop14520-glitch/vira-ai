"""Provider contracts without external SDK implementations."""

from dataclasses import dataclass
from typing import Literal, Protocol


ProviderName = Literal["openai", "anthropic", "xai", "ollama"]


@dataclass(frozen=True)
class ProviderRequest:
    """Provider-neutral request shape for future use."""

    model: str
    prompt: str


@dataclass(frozen=True)
class ProviderResponse:
    """Provider-neutral response shape for future use."""

    text: str


class AIProvider(Protocol):
    """Interface future provider adapters must implement."""

    name: ProviderName

    def generate(self, request: ProviderRequest) -> ProviderResponse:
        """Generate a response without exposing vendor details to callers."""

