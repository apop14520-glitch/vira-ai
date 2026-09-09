from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_root_route_orients_local_api_visits() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {
        "service": "vira-api",
        "status": "ok",
        "health": "/health",
        "docs": "/docs",
    }


def test_healthcheck_returns_expected_contract() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "vira-api"}
    assert response.headers["x-request-id"]
    assert response.headers["x-content-type-options"] == "nosniff"


def test_versioned_api_namespace_is_available() -> None:
    response = client.get("/api/v1/")

    assert response.status_code == 200
    assert response.json() == {"service": "vira-api", "version": "v1"}
