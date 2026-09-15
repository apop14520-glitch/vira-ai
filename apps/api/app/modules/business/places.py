"""Foursquare Places adapter used only after explicit local configuration."""

from dataclasses import dataclass
from typing import Any

import httpx

from app.modules.business.category_localization import translate_category_name, translate_category_names

FOURSQUARE_SEARCH_URL = "https://places-api.foursquare.com/places/search"
# Foursquare's older v3 endpoint is still used by existing API keys. Keep it
# as a compatibility fallback while the current Service Key endpoint remains
# the primary integration path.
FOURSQUARE_LEGACY_SEARCH_URL = "https://api.foursquare.com/v3/places/search"
FOURSQUARE_API_VERSION = "2025-06-17"


class PlacesNotConfiguredError(Exception):
    """Raised when no Foursquare Service Key is available."""


class PlacesProviderError(Exception):
    """Raised when the provider cannot complete a safe search."""


@dataclass(frozen=True)
class PlaceSearchInput:
    establishment_name: str
    city: str
    state: str
    quantity: int = 20


@dataclass(frozen=True)
class PlaceSearchResult:
    place_id: str
    name: str
    segment: str
    city: str
    state: str
    address: str | None
    website: str | None
    website_status: str
    source: str


def serialize_place(result: PlaceSearchResult) -> dict[str, str | None]:
    """Return the explicit company-only response contract."""

    return {
        "place_id": result.place_id,
        "name": result.name,
        "segment": result.segment,
        "city": result.city,
        "state": result.state,
        "address": result.address,
        "website": result.website,
        "website_status": result.website_status,
        "source": result.source,
    }


class FoursquarePlacesService:
    """Keep credentials server-side and return only company-oriented fields."""

    def __init__(self, configured_key: str | None = None) -> None:
        self._configured_key = configured_key.strip() if configured_key else None
        self._runtime_key: str | None = None
        self._runtime_key_cleared = False

    @property
    def configured(self) -> bool:
        return bool(self._runtime_key or (self._configured_key and not self._runtime_key_cleared))

    @property
    def configuration_mode(self) -> str:
        if self._runtime_key:
            return "sessao_local"
        return "ambiente" if self.configured else "nao_configurada"

    def set_runtime_key(self, key: str) -> None:
        self._runtime_key = key.strip()
        self._runtime_key_cleared = False

    def clear_runtime_key(self) -> None:
        self._runtime_key = None
        self._runtime_key_cleared = True

    def _key(self) -> str | None:
        if self._runtime_key:
            return self._runtime_key
        if self._runtime_key_cleared:
            return None
        return self._configured_key

    async def search(self, payload: PlaceSearchInput) -> list[PlaceSearchResult]:
        key = self._key()
        if not key:
            raise PlacesNotConfiguredError
        params = {
            "query": payload.establishment_name.strip(),
            "near": f"{payload.city.strip()}, {payload.state.strip()}, Brasil",
            "limit": min(max(payload.quantity, 1), 20),
            "exclude_all_chains": "false",
            "fields": "fsq_place_id,name,location,categories,website",
        }
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {key}",
            "X-Places-Api-Version": FOURSQUARE_API_VERSION,
        }
        response: Any | None = None
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.get(FOURSQUARE_SEARCH_URL, params=params, headers=headers)
                if response.status_code in {401, 403}:
                    # Existing integrations may still contain a legacy v3 API
                    # key, which is authenticated without the Bearer scheme.
                    # Retry only authentication failures so normal provider
                    # errors and rate limits are never duplicated.
                    try:
                        legacy_response = await client.get(
                            FOURSQUARE_LEGACY_SEARCH_URL,
                            params=params,
                            headers={"Accept": "application/json", "Authorization": key},
                        )
                    except httpx.RequestError:
                        legacy_response = None
                    if legacy_response is not None:
                        response = legacy_response
        except httpx.RequestError as error:
            raise PlacesProviderError("Não foi possível conectar à Foursquare agora.") from error
        if response.status_code in {401, 403}:
            raise PlacesProviderError("A chave da Foursquare não foi aceita ou não tem acesso à busca de locais.")
        if response.status_code == 429:
            raise PlacesProviderError("O limite de consultas da Foursquare foi atingido. Tente novamente mais tarde.")
        if response.status_code == 400:
            raise PlacesProviderError("A Foursquare rejeitou os parâmetros da busca. Confira o nome da cidade e a UF, por exemplo: Porto Velho, RO.")
        if response.status_code >= 400:
            raise PlacesProviderError("A Foursquare recusou a busca. Confira a cidade, a UF e a chave configurada.")
        try:
            data = response.json()
        except ValueError as error:
            raise PlacesProviderError("A resposta da Foursquare não pôde ser interpretada.") from error
        return [self._map_result(item, payload) for item in data.get("results", []) if self._valid(item)]

    @staticmethod
    def _valid(item: Any) -> bool:
        return isinstance(item, dict) and bool(item.get("fsq_place_id") or item.get("fsq_id")) and bool(item.get("name"))

    @staticmethod
    def _map_result(item: dict[str, Any], payload: PlaceSearchInput) -> PlaceSearchResult:
        location = item.get("location") or {}
        address = location.get("formatted_address") or location.get("address")
        website = item.get("website")
        return PlaceSearchResult(
            place_id=str(item.get("fsq_place_id") or item.get("fsq_id")),
            name=str(item["name"]).strip(),
            segment=FoursquarePlacesService._category_name(item)
            or translate_category_name(payload.establishment_name.strip()),
            city=str(location.get("locality") or payload.city).strip(),
            state=str(location.get("region") or payload.state).strip().upper()[:2],
            address=str(address).strip() if address else None,
            website=str(website).strip() if website else None,
            website_status="informado" if website else "nao_verificado",
            source="Foursquare Places",
        )

    @staticmethod
    def _category_name(item: dict[str, Any]) -> str | None:
        categories = item.get("categories") or []
        names = [str(category.get("name", "")).strip() for category in categories if isinstance(category, dict)]
        return translate_category_names(names)
