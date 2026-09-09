"""Dependency-free feature flag abstraction for local development."""

from collections.abc import Mapping
from uuid import UUID


class FeatureFlagService:
    """Evaluate flags globally or per organization without an external service."""

    def __init__(self, defaults: Mapping[str, bool] | None = None) -> None:
        self._defaults = dict(defaults or {})
        self._organization_flags: dict[UUID, dict[str, bool]] = {}

    def is_enabled(self, flag: str, organization_id: UUID | None = None) -> bool:
        if organization_id in self._organization_flags:
            if flag in self._organization_flags[organization_id]:
                return self._organization_flags[organization_id][flag]
        return self._defaults.get(flag, False)

    def set_for_organization(self, organization_id: UUID, flag: str, enabled: bool) -> None:
        self._organization_flags.setdefault(organization_id, {})[flag] = enabled

