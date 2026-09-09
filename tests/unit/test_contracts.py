from uuid import UUID

from core.domain.provenance import DataProvenance
from core.providers.ai.contracts import AIRequest
from database.models.base import Entity


def test_primary_contracts_are_vendor_and_database_neutral() -> None:
    entity = Entity()
    request = AIRequest(model="future-model", prompt="placeholder", purpose="future-purpose")

    assert isinstance(entity.id, UUID)
    assert request.organization_id is None
