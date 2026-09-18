from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


def test_topic_and_question_lifecycle_with_audit_trail() -> None:
    suffix = uuid4().hex[:8]
    with TestClient(app) as client:
        topic = client.post(
            "/api/v1/concursos/topics",
            json={"name": f"Redes de Computadores {suffix}", "description": "Fundamentos de TI"},
        )
        assert topic.status_code == 201
        topic_id = topic.json()["id"]
        assert topic.json()["question_count"] == 0

        question = client.post(
            "/api/v1/concursos/questions",
            json={
                "topic_id": topic_id,
                "statement": "Qual protocolo resolve nomes de domínio em endereços IP?",
                "option_a": "HTTP",
                "option_b": "DNS",
                "option_c": "FTP",
                "option_d": "SMTP",
                "correct_option": "b",
                "explanation": "DNS traduz nomes de domínio em endereços IP.",
                "difficulty": "facil",
            },
        )
        assert question.status_code == 201
        question_id = question.json()["id"]

        topics = client.get("/api/v1/concursos/topics").json()
        created_topic = next(item for item in topics if item["id"] == topic_id)
        assert created_topic["question_count"] == 1

        events = client.get("/api/v1/concursos/audit")
        assert events.status_code == 200
        actions = [event["action"] for event in events.json()]
        assert "topic.created" in actions
        assert "question.created" in actions

        deleted = client.delete(f"/api/v1/concursos/questions/{question_id}")
        assert deleted.status_code == 204
        assert client.delete(f"/api/v1/concursos/topics/{topic_id}").status_code == 204


def test_quiz_can_be_started_and_graded() -> None:
    suffix = uuid4().hex[:8]
    with TestClient(app) as client:
        topic_id = client.post(
            "/api/v1/concursos/topics", json={"name": f"Banco de Dados {suffix}"}
        ).json()["id"]

        first = client.post(
            "/api/v1/concursos/questions",
            json={
                "topic_id": topic_id,
                "statement": "Qual comando SQL remove linhas de uma tabela?",
                "option_a": "SELECT",
                "option_b": "UPDATE",
                "option_c": "DELETE",
                "option_d": "CREATE",
                "correct_option": "c",
            },
        ).json()

        started = client.post(
            "/api/v1/concursos/quiz/start", json={"topic_id": topic_id, "quantity": 5}
        )
        assert started.status_code == 200
        questions = started.json()
        assert len(questions) == 1
        assert "correct_option" not in questions[0]

        submitted = client.post(
            "/api/v1/concursos/quiz/submit",
            json={
                "topic_id": topic_id,
                "answers": [{"question_id": first["id"], "selected_option": "c"}],
            },
        )
        assert submitted.status_code == 200
        result = submitted.json()
        assert result["total"] == 1
        assert result["correct"] == 1
        assert result["results"][0]["is_correct"] is True

        summary = client.get("/api/v1/concursos/summary")
        assert summary.status_code == 200
        assert summary.json()["total_questions"] >= 1


def test_question_supports_an_optional_fifth_option() -> None:
    suffix = uuid4().hex[:8]
    with TestClient(app) as client:
        topic_id = client.post(
            "/api/v1/concursos/topics", json={"name": f"Direito {suffix}"}
        ).json()["id"]

        with_five = client.post(
            "/api/v1/concursos/questions",
            json={
                "topic_id": topic_id,
                "statement": "Qual alternativa está correta sobre o tema?",
                "option_a": "A",
                "option_b": "B",
                "option_c": "C",
                "option_d": "D",
                "option_e": "E",
                "correct_option": "e",
            },
        )
        assert with_five.status_code == 201
        assert with_five.json()["option_e"] == "E"

        without_five = client.post(
            "/api/v1/concursos/questions",
            json={
                "topic_id": topic_id,
                "statement": "Outra pergunta sem quinta alternativa cadastrada.",
                "option_a": "A",
                "option_b": "B",
                "option_c": "C",
                "option_d": "D",
                "correct_option": "b",
            },
        )
        assert without_five.status_code == 201
        assert without_five.json()["option_e"] is None


def test_question_requires_an_existing_topic() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/concursos/questions",
            json={
                "topic_id": str(uuid4()),
                "statement": "Pergunta sem tópico válido associado a ela.",
                "option_a": "A",
                "option_b": "B",
                "option_c": "C",
                "option_d": "D",
                "correct_option": "a",
            },
        )
        assert response.status_code == 404


def test_duplicate_topic_name_is_rejected() -> None:
    suffix = uuid4().hex[:8]
    payload = {"name": f"Tópico Duplicado {suffix}"}
    with TestClient(app) as client:
        assert client.post("/api/v1/concursos/topics", json=payload).status_code == 201
        duplicated = client.post("/api/v1/concursos/topics", json=payload)
        assert duplicated.status_code == 409
