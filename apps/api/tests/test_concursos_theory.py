from copy import deepcopy
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app

BASE = "/api/v1/concursos"

THEORY = {
    "summary": "Arquitetura, algoritmos e estruturas de dados",
    "sources": "Manual Completo para Concursos de TI, edição 3.0+",
    "chapters": [
        {
            "number": "1.1",
            "title": "Organização e arquitetura de computadores",
            "objective": "Explicar como o processador se liga à memória.",
            "sections": [
                {
                    "heading": "O sistema computacional",
                    "blocks": [
                        {"type": "paragraph", "text": "Um sistema computacional recebe dados e produz resultados."},
                        {"type": "definition", "term": "ULA", "text": "unidade que executa operações aritméticas."},
                        {"type": "callout", "text": "Cache não substitui a RAM."},
                        {
                            "type": "table",
                            "caption": "Barramentos",
                            "header": ["Grupo", "Pergunta respondida"],
                            "rows": [["Dados", "O que é transferido?"], ["Endereços", "Onde está?"]],
                        },
                    ],
                }
            ],
            "review": ["A CPU coordena a execução.", "Cache reduz a latência média."],
        }
    ],
}


def _topic(client: TestClient) -> str:
    return client.post(f"{BASE}/topics", json={"name": f"Parte 1 — Teoria {uuid4().hex[:8]}"}).json()["id"]


def test_theory_is_saved_replaced_and_read_back() -> None:
    with TestClient(app) as client:
        topic_id = _topic(client)

        assert client.get(f"{BASE}/topics/{topic_id}/theory").status_code == 404
        listed = next(item for item in client.get(f"{BASE}/topics").json() if item["id"] == topic_id)
        assert listed["has_theory"] is False

        saved = client.put(f"{BASE}/topics/{topic_id}/theory", json=THEORY)
        assert saved.status_code == 200
        assert saved.json()["topic_id"] == topic_id
        assert saved.json()["chapters"] == 1

        read = client.get(f"{BASE}/topics/{topic_id}/theory")
        assert read.status_code == 200
        assert read.json() == THEORY
        listed = next(item for item in client.get(f"{BASE}/topics").json() if item["id"] == topic_id)
        assert listed["has_theory"] is True

        second = deepcopy(THEORY)
        second["chapters"].append({**THEORY["chapters"][0], "number": "1.2", "title": "Algoritmos"})
        assert client.put(f"{BASE}/topics/{topic_id}/theory", json=second).json()["chapters"] == 2
        assert [chapter["number"] for chapter in client.get(f"{BASE}/topics/{topic_id}/theory").json()["chapters"]] == [
            "1.1",
            "1.2",
        ]

        actions = [event["action"] for event in client.get(f"{BASE}/audit").json()]
        assert "theory.imported" in actions


def test_theory_requires_an_existing_topic() -> None:
    with TestClient(app) as client:
        missing = str(uuid4())
        assert client.get(f"{BASE}/topics/{missing}/theory").status_code == 404
        assert client.put(f"{BASE}/topics/{missing}/theory", json=THEORY).status_code == 404


def test_theory_rejects_malformed_documents() -> None:
    with TestClient(app) as client:
        topic_id = _topic(client)
        url = f"{BASE}/topics/{topic_id}/theory"

        no_chapters = {**THEORY, "chapters": []}
        assert client.put(url, json=no_chapters).status_code == 422

        unknown_block = deepcopy(THEORY)
        unknown_block["chapters"][0]["sections"][0]["blocks"][0] = {"type": "video", "text": "x"}
        assert client.put(url, json=unknown_block).status_code == 422

        ragged_table = deepcopy(THEORY)
        ragged_table["chapters"][0]["sections"][0]["blocks"][3]["rows"][0] = ["só uma coluna"]
        assert client.put(url, json=ragged_table).status_code == 422

        empty_text = deepcopy(THEORY)
        empty_text["chapters"][0]["sections"][0]["blocks"][0]["text"] = ""
        assert client.put(url, json=empty_text).status_code == 422

        assert client.get(url).status_code == 404


def test_theory_is_deleted_with_its_topic() -> None:
    with TestClient(app) as client:
        topic_id = _topic(client)
        assert client.put(f"{BASE}/topics/{topic_id}/theory", json=THEORY).status_code == 200

        repository = app.state.concursos
        with repository.database.connect() as connection:
            count = connection.execute(
                "SELECT COUNT(*) FROM concursos_theory WHERE topic_id = ?", (topic_id,)
            ).fetchone()[0]
        assert count == 1

        assert client.delete(f"{BASE}/topics/{topic_id}").status_code == 204
        with repository.database.connect() as connection:
            count = connection.execute(
                "SELECT COUNT(*) FROM concursos_theory WHERE topic_id = ?", (topic_id,)
            ).fetchone()[0]
        assert count == 0
