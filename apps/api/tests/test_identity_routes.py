from collections.abc import Iterator
from datetime import UTC, datetime
from importlib import import_module
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.sqlite import SQLiteDatabase
from app.modules.identity.repository import SQLiteIdentityRepository
from app.security.rate_limit import SlidingWindowRateLimiter
from app.security.sessions import AdminSessionService
from app.settings import Settings


INITIAL_PASSWORD = "Vira-admin-2026!"
NEW_PASSWORD = "Vira-nova-2026!"
ORGANIZATION_ID = UUID("00000000-0000-4000-8000-000000000001")


@pytest.fixture
def identity_client(tmp_path) -> Iterator[tuple[TestClient, Settings]]:
    database = SQLiteDatabase(f"sqlite:///{(tmp_path / 'identity-routes.db').as_posix()}")
    database.initialize()
    repository = SQLiteIdentityRepository(database)
    repository.initialize_schema()
    settings = Settings(
        environment="development",
        allow_development_auth_bypass=False,
        admin_username="admin",
        admin_initial_password=INITIAL_PASSWORD,
        auth_organization_id=ORGANIZATION_ID,
        admin_session_cookie_name="vira_admin_session",
    )
    service = AdminSessionService(
        credential_repository=repository,
        session_repository=repository,
        settings=settings,
        clock=lambda: datetime(2026, 9, 15, 12, 0, tzinfo=UTC),
        token_generator=lambda: f"raw-session-{uuid4().hex}",
    )

    with TestClient(app) as client:
        previous = {
            "settings": getattr(app.state, "settings", None),
            "identity": getattr(app.state, "identity", None),
            "admin_sessions": getattr(app.state, "admin_sessions", None),
            "identity_rate_limiter": getattr(app.state, "identity_rate_limiter", None),
        }
        app.state.settings = settings
        app.state.identity = repository
        app.state.admin_sessions = service
        app.state.identity_rate_limiter = SlidingWindowRateLimiter(5, 60)
        service.ensure_initial_credential()
        try:
            yield client, settings
        finally:
            for name, value in previous.items():
                setattr(app.state, name, value)
    database.close()


def test_login_sets_a_protected_cookie_and_session_is_readable(identity_client) -> None:
    client, _ = identity_client

    login = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": INITIAL_PASSWORD},
        headers={"X-Request-ID": "identity-login-success"},
    )

    assert login.status_code == 200
    assert login.json() == {"authenticated": True, "username": "admin"}
    set_cookie = login.headers["set-cookie"].lower()
    assert "httponly" in set_cookie
    assert "samesite=lax" in set_cookie
    assert "path=/" in set_cookie
    assert INITIAL_PASSWORD not in login.text

    session = client.get("/api/v1/auth/session")
    assert session.status_code == 200
    assert session.json() == {
        "authenticated": True,
        "username": "admin",
        "organization_id": str(ORGANIZATION_ID),
    }


def test_application_lifespan_initializes_identity_rate_limiter(tmp_path, monkeypatch) -> None:
    """The real application startup must make the login route usable."""

    app_module = import_module("app.main")
    settings = Settings(
        environment="development",
        allow_development_auth_bypass=False,
        admin_username="admin",
        admin_initial_password=INITIAL_PASSWORD,
        database_url=f"sqlite:///{(tmp_path / 'lifespan.db').as_posix()}",
        auth_organization_id=ORGANIZATION_ID,
        admin_session_cookie_name="vira_admin_session",
    )
    monkeypatch.setattr(app_module, "settings", settings)

    with TestClient(app_module.app) as client:
        response = client.post(
            "/api/v1/auth/login",
            json={"username": "admin", "password": INITIAL_PASSWORD},
        )

    assert response.status_code == 200
    assert response.json() == {"authenticated": True, "username": "admin"}


def test_invalid_login_has_a_generic_response_without_credentials(identity_client) -> None:
    client, _ = identity_client

    wrong_password = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "wrong-password-2026!"},
    )
    unknown_user = client.post(
        "/api/v1/auth/login",
        json={"username": "unknown", "password": "wrong-password-2026!"},
    )

    assert wrong_password.status_code == 401
    assert unknown_user.status_code == 401
    assert wrong_password.json()["error"]["message"] == unknown_user.json()["error"]["message"]
    assert INITIAL_PASSWORD not in wrong_password.text
    assert "admin" not in unknown_user.text.lower()


def test_login_rate_limit_returns_retry_after(identity_client) -> None:
    client, settings = identity_client
    settings.admin_login_rate_limit = 1
    app.state.identity_rate_limiter = SlidingWindowRateLimiter(
        settings.admin_login_rate_limit,
        settings.admin_login_rate_window_seconds,
    )

    first = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "wrong-password-2026!"},
    )
    second = client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": "wrong-password-2026!"},
    )

    assert first.status_code == 401
    assert second.status_code == 429
    assert int(second.headers["retry-after"]) >= 1


def test_logout_revokes_the_current_session(identity_client) -> None:
    client, _ = identity_client
    assert client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": INITIAL_PASSWORD},
    ).status_code == 200

    logout = client.post(
        "/api/v1/auth/logout",
        headers={"X-Request-ID": "identity-logout"},
    )

    assert logout.status_code == 204
    assert client.get("/api/v1/auth/session").status_code == 401


def test_password_change_revokes_old_session_and_old_password(identity_client) -> None:
    client, _ = identity_client
    assert client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": INITIAL_PASSWORD},
    ).status_code == 200

    changed = client.put(
        "/api/v1/auth/password",
        json={
            "current_password": INITIAL_PASSWORD,
            "new_password": NEW_PASSWORD,
            "confirmation": NEW_PASSWORD,
        },
        headers={"X-Request-ID": "identity-password-change"},
    )

    assert changed.status_code == 204
    assert client.get("/api/v1/auth/session").status_code == 401
    assert client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": INITIAL_PASSWORD},
    ).status_code == 401
    assert client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": NEW_PASSWORD},
    ).status_code == 200


def test_identity_operations_write_audit_context_without_secrets(identity_client) -> None:
    client, _ = identity_client
    login_request_id = f"identity-audit-login-{uuid4().hex[:8]}"
    logout_request_id = f"identity-audit-logout-{uuid4().hex[:8]}"
    assert client.post(
        "/api/v1/auth/login",
        json={"username": "admin", "password": INITIAL_PASSWORD},
        headers={"X-Request-ID": login_request_id},
    ).status_code == 200
    assert client.post(
        "/api/v1/auth/logout",
        headers={"X-Request-ID": logout_request_id},
    ).status_code == 204

    with app.state.company_leads.database.connect() as connection:
        events = connection.execute(
            """
            SELECT action, actor_id, organization_id, request_id, metadata_json
            FROM business_audit_events
            WHERE request_id IN (?, ?)
            ORDER BY occurred_at ASC
            """,
            (login_request_id, logout_request_id),
        ).fetchall()

    assert [event["action"] for event in events] == ["admin_login_succeeded", "admin_logout"]
    assert all(event["actor_id"] == str(app.state.settings.admin_actor_id) for event in events)
    assert all(event["organization_id"] == str(ORGANIZATION_ID) for event in events)
    assert all(INITIAL_PASSWORD not in event["metadata_json"] for event in events)
