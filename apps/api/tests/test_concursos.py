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


def _create_question(client: TestClient, topic_id: str, statement: str, correct: str, explanation: str = "") -> dict:
    response = client.post(
        "/api/v1/concursos/questions",
        json={
            "topic_id": topic_id,
            "statement": statement,
            "option_a": "A",
            "option_b": "B",
            "option_c": "C",
            "option_d": "D",
            "correct_option": correct,
            "explanation": explanation,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_study_mode_draws_from_chosen_topics_and_gives_instant_feedback() -> None:
    suffix = uuid4().hex[:8]
    with TestClient(app) as client:
        topic_a = client.post("/api/v1/concursos/topics", json={"name": f"Estudo A {suffix}"}).json()["id"]
        topic_b = client.post("/api/v1/concursos/topics", json={"name": f"Estudo B {suffix}"}).json()["id"]
        first = _create_question(client, topic_a, "Pergunta do primeiro tópico de estudo?", "b", "Porque B.")
        _create_question(client, topic_b, "Pergunta do segundo tópico de estudo?", "c")

        drawn = client.post("/api/v1/concursos/questions/draw", json={"topic_ids": [topic_a], "quantity": 10})
        assert drawn.status_code == 200
        assert [item["id"] for item in drawn.json()] == [first["id"]]
        assert "correct_option" not in drawn.json()[0]

        both = client.post("/api/v1/concursos/questions/draw", json={"topic_ids": [topic_a, topic_b], "quantity": 10})
        assert len(both.json()) == 2

        wrong = client.post(
            "/api/v1/concursos/questions/check", json={"question_id": first["id"], "selected_option": "a"}
        )
        assert wrong.status_code == 200
        assert wrong.json()["is_correct"] is False
        assert wrong.json()["correct_option"] == "b"
        assert wrong.json()["explanation"] == "Porque B."

        right = client.post(
            "/api/v1/concursos/questions/check", json={"question_id": first["id"], "selected_option": "b"}
        )
        assert right.json()["is_correct"] is True


def test_check_answer_rejects_unknown_question() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/concursos/questions/check", json={"question_id": str(uuid4()), "selected_option": "a"}
        )
        assert response.status_code == 404


def test_exam_is_graded_across_topics_and_audited() -> None:
    suffix = uuid4().hex[:8]
    with TestClient(app) as client:
        topic_a = client.post("/api/v1/concursos/topics", json={"name": f"Prova A {suffix}"}).json()["id"]
        topic_b = client.post("/api/v1/concursos/topics", json={"name": f"Prova B {suffix}"}).json()["id"]
        first = _create_question(client, topic_a, "Questão da prova vinda do tópico A?", "a")
        second = _create_question(client, topic_b, "Questão da prova vinda do tópico B?", "d", "Porque D.")
        third = _create_question(client, topic_b, "Questão da prova deixada em branco?", "c")

        submitted = client.post(
            "/api/v1/concursos/exams/submit",
            json={
                "answers": [
                    {"question_id": first["id"], "selected_option": "a"},
                    {"question_id": second["id"], "selected_option": "b"},
                ],
                "blank_question_ids": [third["id"]],
            },
        )
        assert submitted.status_code == 200
        result = submitted.json()
        assert result["total"] == 3
        assert result["correct"] == 1
        assert result["blank"] == 1
        assert [item["is_correct"] for item in result["results"]] == [True, False, False]
        blank_item = result["results"][2]
        assert blank_item["selected_option"] is None
        assert blank_item["correct_option"] == "c"

        actions = [event["action"] for event in client.get("/api/v1/concursos/audit").json()]
        assert "exam.completed" in actions

        missing = client.post(
            "/api/v1/concursos/exams/submit",
            json={"answers": [{"question_id": str(uuid4()), "selected_option": "a"}]},
        )
        assert missing.status_code == 404

        empty = client.post("/api/v1/concursos/exams/submit", json={"answers": [], "blank_question_ids": []})
        assert empty.status_code == 422
