import json
from collections.abc import Mapping
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from starlette.requests import Request

from app.main import app
from app.security.auth import (
    AuthenticationError,
    AuthorizationError,
    Principal,
    authenticate_request,
    get_current_principal,
    require_admin,
)
from app.security.rate_limit import SlidingWindowRateLimiter
from app.settings import Settings


def request_with_headers(headers: Mapping[str, str] | None = None) -> Request:
    raw_headers = []
    for name, value in (headers or {}).items():
        raw_headers.append((name.lower().encode(), value.encode()))
    return Request({"type": "http", "headers": raw_headers})


def test_production_authentication_rejects_missing_bearer_token() -> None:
    settings = Settings(
        environment="production",
        api_access_token="operator-token",
        admin_access_token="admin-token",
        auth_organization_id=UUID("00000000-0000-4000-8000-000000000099"),
    )

    with pytest.raises(AuthenticationError):
        authenticate_request(request_with_headers(), settings)


def test_development_authentication_rejects_malformed_authorization_header() -> None:
    settings = Settings(environment="development", allow_development_auth_bypass=True)

    with pytest.raises(AuthenticationError):
        authenticate_request(request_with_headers({"Authorization": "Basic invalid"}), settings)


def test_business_authentication_error_preserves_www_authenticate_header() -> None:
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/business/leads",
            headers={"Authorization": "Basic invalid"},
        )

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_admin_token_resolves_authenticated_tenant_and_role() -> None:
    organization_id = UUID("00000000-0000-4000-8000-000000000099")
    settings = Settings(
        environment="production",
        api_access_token="operator-token",
        admin_access_token="admin-token",
        auth_organization_id=organization_id,
    )

    principal = authenticate_request(
        request_with_headers({"Authorization": "Bearer admin-token"}),
        settings,
    )

    assert principal.organization_id == organization_id
    assert principal.actor_id == settings.admin_actor_id
    assert principal.has_role("admin")
    assert require_admin(principal) is principal


def test_operator_cannot_use_admin_only_operations() -> None:
    principal = Principal(
        actor_id=UUID("00000000-0000-4000-8000-000000000003"),
        organization_id=UUID("00000000-0000-4000-8000-000000000099"),
        roles=frozenset({"operator"}),
    )

    with pytest.raises(AuthorizationError):
        require_admin(principal)


def test_development_authentication_uses_explicit_local_principal() -> None:
    settings = Settings(environment="development", allow_development_auth_bypass=True)

    principal = authenticate_request(request_with_headers(), settings)

    assert principal.actor_id == settings.development_actor_id
    assert principal.organization_id == settings.development_organization_id
    assert principal.has_role("admin")


def test_production_settings_require_authentication_configuration() -> None:
    with pytest.raises(ValueError, match="API_ACCESS_TOKEN"):
        Settings(environment="production")


def test_rate_limiter_rejects_requests_after_configured_limit() -> None:
    limiter = SlidingWindowRateLimiter(max_requests=2, window_seconds=60)

    assert limiter.allow("actor-1") is True
    assert limiter.allow("actor-1") is True
    assert limiter.allow("actor-1") is False
    assert limiter.allow("actor-2") is True


def test_business_audit_records_actor_request_and_safe_metadata() -> None:
    suffix = uuid4().hex[:8]
    payload = {
        "company_name": f"Empresa Auditada {suffix}",
        "segment": "Serviços",
        "city": "Manaus",
        "state": "AM",
        "source": "teste de auditoria",
    }
    request_id = f"audit-test-{suffix}"

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/business/leads",
            json=payload,
            headers={"X-Request-ID": request_id},
        )
        assert response.status_code == 201

        with app.state.company_leads.database.connect() as connection:
            row = connection.execute(
                """SELECT actor_id, request_id, action, resource_type, outcome, metadata_json
                FROM business_audit_events
                WHERE resource_id = ?
                ORDER BY occurred_at DESC
                LIMIT 1""",
                (response.json()["id"],),
            ).fetchone()

    assert row["actor_id"] == str(app.state.settings.development_actor_id)
    assert row["request_id"] == request_id
    assert row["action"] == "company_lead.created"
    assert row["resource_type"] == "company_lead"
    assert row["outcome"] == "success"
    assert "api_key" not in row["metadata_json"].lower()
    assert json.loads(row["metadata_json"]) == {"source": "teste de auditoria"}


def test_operator_cannot_configure_foursquare_through_business_route() -> None:
    operator = Principal(
        actor_id=UUID("00000000-0000-4000-8000-000000000003"),
        organization_id=UUID("00000000-0000-4000-8000-000000000099"),
        roles=frozenset({"operator"}),
    )
    app.dependency_overrides[get_current_principal] = lambda: operator
    try:
        with TestClient(app) as client:
            response = client.put(
                "/api/v1/business/integrations/foursquare",
                json={"api_key": "should-not-be-accepted"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 403


def test_foursquare_configuration_and_rejected_search_are_audited_without_key() -> None:
    suffix = uuid4().hex[:8]
    configure_request_id = f"foursquare-config-{suffix}"
    search_request_id = f"foursquare-search-{suffix}"

    with TestClient(app) as client:
        configured = client.put(
            "/api/v1/business/integrations/foursquare",
            json={"api_key": "runtime-secret-that-must-not-be-audited"},
            headers={"X-Request-ID": configure_request_id},
        )
        assert configured.status_code == 200

        client.put(
            "/api/v1/business/integrations/foursquare",
            json={"clear": True},
            headers={"X-Request-ID": f"foursquare-clear-{suffix}"},
        )
        rejected = client.post(
            "/api/v1/business/places/search",
            json={"establishment_name": "Padaria", "city": "Manaus", "state": "AM", "quantity": 1},
            headers={"X-Request-ID": search_request_id},
        )
        assert rejected.status_code == 412

        with app.state.company_leads.database.connect() as connection:
            events = connection.execute(
                """SELECT action, request_id, resource_type, outcome, metadata_json
                FROM business_audit_events
                WHERE request_id IN (?, ?)
                ORDER BY occurred_at ASC""",
                (configure_request_id, search_request_id),
            ).fetchall()

    assert [event["action"] for event in events] == [
        "integration.foursquare.configured",
        "integration.foursquare.search",
    ]
    assert events[0]["resource_type"] == "integration"
    assert events[0]["outcome"] == "success"
    assert events[1]["outcome"] == "rejected"
    assert "runtime-secret" not in events[0]["metadata_json"]
