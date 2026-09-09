from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


def test_company_only_lead_can_move_through_pipeline() -> None:
    """The first VIRA Business slice must work without personal data fields."""

    suffix = uuid4().hex[:8]
    payload = {
        "company_name": f"Empresa de Teste {suffix}",
        "segment": "Tecnologia",
        "city": "Manaus",
        "state": "am",
        "website": "https://example.com",
        "source": "teste automatizado",
        "priority": "alta",
    }
    with TestClient(app) as client:
        created = client.post("/api/v1/business/leads", json=payload)
        assert created.status_code == 201
        lead = created.json()
        assert lead["state"] == "AM"
        assert isinstance(lead["lead_number"], int)
        assert lead["status"] == "novo"
        assert "email" not in lead
        assert "phone" not in lead

        moved = client.patch(
            f"/api/v1/business/leads/{lead['id']}/status",
            json={"status": "qualificado", "version": lead["version"]},
        )
        assert moved.status_code == 200
        assert moved.json()["status"] == "qualificado"
        assert moved.json()["version"] == 2

        summary = client.get("/api/v1/business/summary")
        assert summary.status_code == 200
        assert summary.json()["by_status"]["qualificado"] >= 1


def test_leads_receive_unique_numbers_and_can_be_deleted() -> None:
    first_suffix = uuid4().hex[:8]
    second_suffix = uuid4().hex[:8]
    first_payload = {
        "company_name": f"Empresa para Excluir {first_suffix}",
        "segment": "Serviços",
        "city": "Manaus",
        "state": "AM",
        "source": "teste automatizado",
    }
    second_payload = {**first_payload, "company_name": f"Empresa para Excluir {second_suffix}"}

    with TestClient(app) as client:
        first = client.post("/api/v1/business/leads", json=first_payload).json()
        second = client.post("/api/v1/business/leads", json=second_payload).json()
        assert first["lead_number"] != second["lead_number"]

        deleted = client.delete(f"/api/v1/business/leads/{first['id']}")
        assert deleted.status_code == 204
        listed = client.get("/api/v1/business/leads", params={"query": first_payload["company_name"]})
        assert listed.status_code == 200
        assert listed.json() == []

        assert client.delete(f"/api/v1/business/leads/{second['id']}").status_code == 204
        third = client.post("/api/v1/business/leads", json={**first_payload, "company_name": f"Empresa para Excluir {uuid4().hex[:8]}"}).json()
        assert third["lead_number"] > second["lead_number"]
        assert client.delete(f"/api/v1/business/leads/{third['id']}").status_code == 204


def test_duplicate_company_and_city_is_rejected() -> None:
    suffix = uuid4().hex[:8]
    payload = {
        "company_name": f"Empresa Duplicada {suffix}",
        "segment": "Serviços",
        "city": "Belém",
        "state": "PA",
        "source": "teste automatizado",
    }
    with TestClient(app) as client:
        assert client.post("/api/v1/business/leads", json=payload).status_code == 201
        duplicated = client.post("/api/v1/business/leads", json=payload)
        assert duplicated.status_code == 409
        assert duplicated.json()["error"]["code"] == "HTTP_ERROR"


def test_foursquare_is_disabled_until_a_key_is_configured() -> None:
    with TestClient(app) as client:
        configuration = client.get("/api/v1/business/integrations/foursquare")
        assert configuration.status_code == 200
        assert configuration.json()["configured"] is False
        assert "api_key" not in configuration.text.lower()

        search = client.post(
            "/api/v1/business/places/search",
            json={"establishment_name": "Padaria", "city": "Manaus", "state": "AM", "quantity": 20},
        )
        assert search.status_code == 412
        assert "chave" in search.json()["error"]["message"].lower()
