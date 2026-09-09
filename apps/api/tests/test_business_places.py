import asyncio

from app.modules.business.places import FoursquarePlacesService, PlaceSearchInput


class FakeResponse:
    status_code = 200

    def json(self):
        return {
            "results": [
                {
                    "fsq_place_id": "fsq-test-123",
                    "name": "Padaria de Teste",
                    "location": {
                        "formatted_address": "Rua de Teste, 123, Porto Velho - RO",
                        "locality": "Porto Velho",
                        "region": "RO",
                    },
                    "categories": [{"name": "Padaria"}],
                    "website": "https://example.com",
                }
            ]
        }


class FakeClient:
    last_params = None

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, traceback):
        return None

    async def get(self, url, *, params, headers):
        self.last_params = params
        assert headers["Authorization"] == "Bearer test-key"
        assert headers["X-Places-Api-Version"] == "2025-06-17"
        return FakeResponse()


def test_foursquare_place_id_is_mapped_without_personal_fields(monkeypatch) -> None:
    client = FakeClient()
    monkeypatch.setattr(
        "app.modules.business.places.httpx.AsyncClient",
        lambda timeout: client,
    )

    results = asyncio.run(
        FoursquarePlacesService("test-key").search(
            PlaceSearchInput("padaria", "Porto Velho", "RO", 20)
        )
    )

    assert client.last_params["fields"] == "fsq_place_id,name,location,categories,website"
    assert results[0].place_id == "fsq-test-123"
    assert results[0].name == "Padaria de Teste"
    assert results[0].website == "https://example.com"


def test_provider_categories_are_translated_to_portuguese(monkeypatch) -> None:
    client = FakeClient()

    def translated_json(self):
        return {
            "results": [
                {
                    "fsq_place_id": "fsq-category-123",
                    "name": "Padaria Roma",
                    "location": {"locality": "Porto Velho", "region": "RO"},
                    "categories": [{"name": "Market"}, {"name": "Farmers Market"}, {"name": "Breakfast Spot"}],
                }
            ]
        }

    monkeypatch.setattr(
        "app.modules.business.places.httpx.AsyncClient",
        lambda timeout: client,
    )
    monkeypatch.setattr(FakeResponse, "json", translated_json)

    results = asyncio.run(
        FoursquarePlacesService("test-key").search(
            PlaceSearchInput("padaria", "Porto Velho", "RO", 20)
        )
    )

    assert results[0].segment == "Mercado, Feira de produtores, Café da manhã"


def test_generic_provider_categories_are_translated_to_portuguese(monkeypatch) -> None:
    client = FakeClient()

    def generic_category_json(self):
        return {
            "results": [
                {
                    "fsq_place_id": "fsq-generic-category-123",
                    "name": "TW Energia Solar",
                    "location": {"locality": "Porto Velho", "region": "RO"},
                    "categories": [{"name": "Business Service"}, {"name": "Structure"}],
                }
            ]
        }

    monkeypatch.setattr(
        "app.modules.business.places.httpx.AsyncClient",
        lambda timeout: client,
    )
    monkeypatch.setattr(FakeResponse, "json", generic_category_json)

    results = asyncio.run(
        FoursquarePlacesService("test-key").search(
            PlaceSearchInput("energia solar", "Porto Velho", "RO", 20)
        )
    )

    assert results[0].segment == "Serviços empresariais, Estrutura"


def test_already_portuguese_provider_category_is_preserved(monkeypatch) -> None:
    client = FakeClient()

    def portuguese_category_json(self):
        return {
            "results": [
                {
                    "fsq_place_id": "fsq-portuguese-category-123",
                    "name": "Solar da Mangueira",
                    "location": {"locality": "Porto Velho", "region": "RO"},
                    "categories": [{"name": "Churrascaria"}],
                }
            ]
        }

    monkeypatch.setattr(
        "app.modules.business.places.httpx.AsyncClient",
        lambda timeout: client,
    )
    monkeypatch.setattr(FakeResponse, "json", portuguese_category_json)

    results = asyncio.run(
        FoursquarePlacesService("test-key").search(
            PlaceSearchInput("churrascaria", "Porto Velho", "RO", 20)
        )
    )

    assert results[0].segment == "Churrascaria"


def test_unknown_provider_category_uses_a_portuguese_fallback(monkeypatch) -> None:
    client = FakeClient()

    def unknown_category_json(self):
        return {
            "results": [
                {
                    "fsq_place_id": "fsq-unknown-category-123",
                    "name": "Novo estabelecimento",
                    "location": {"locality": "Porto Velho", "region": "RO"},
                    "categories": [{"name": "New Provider Category"}],
                }
            ]
        }

    monkeypatch.setattr(
        "app.modules.business.places.httpx.AsyncClient",
        lambda timeout: client,
    )
    monkeypatch.setattr(FakeResponse, "json", unknown_category_json)

    results = asyncio.run(
        FoursquarePlacesService("test-key").search(
            PlaceSearchInput("novo", "Porto Velho", "RO", 20)
        )
    )

    assert results[0].segment == "Estabelecimento local"
