"""HTTP boundary for the VIRA Concursos question bank and quiz mode."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field

from app.modules.concursos.domain import (
    AuditEvent,
    ConcursosSummary,
    DrawRequest,
    ExamResult,
    ExamSubmission,
    Question,
    QuestionCreate,
    QuestionPublic,
    QuizAnswer,
    QuizAnswerResult,
    QuizResult,
    QuizSubmission,
    Topic,
    TopicCreate,
)
from app.modules.concursos.repository import (
    AuditContext,
    QuestionNotFoundError,
    SQLiteConcursosRepository,
    TopicNotFoundError,
)
from app.security.auth import Principal, get_admin_principal, get_current_principal

router = APIRouter()


class QuizStartRequest(BaseModel):
    topic_id: UUID
    quantity: int = Field(default=10, ge=1, le=50)


def repository(request: Request) -> SQLiteConcursosRepository:
    return request.app.state.concursos


def audit_context(request: Request, principal: Principal) -> AuditContext:
    return AuditContext(actor_id=principal.actor_id, request_id=getattr(request.state, "request_id", "unknown"))


@router.get("/topics", response_model=list[Topic])
def list_topics(request: Request, principal: Principal = Depends(get_current_principal)) -> list[Topic]:
    return repository(request).list_topics(principal.organization_id)


@router.post("/topics", response_model=Topic, status_code=status.HTTP_201_CREATED)
def create_topic(request: Request, payload: TopicCreate, principal: Principal = Depends(get_admin_principal)) -> Topic:
    return repository(request).create_topic(principal.organization_id, payload, audit_context(request, principal))


@router.delete("/topics/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_topic(request: Request, topic_id: UUID, principal: Principal = Depends(get_admin_principal)) -> None:
    try:
        repository(request).delete_topic(principal.organization_id, topic_id, audit_context(request, principal))
    except TopicNotFoundError as error:
        raise HTTPException(status_code=404, detail="Tópico não encontrado.") from error


@router.get("/questions", response_model=list[Question])
def list_questions(
    request: Request,
    topic_id: UUID | None = Query(default=None),
    principal: Principal = Depends(get_admin_principal),
) -> list[Question]:
    return repository(request).list_questions(principal.organization_id, topic_id)


@router.post("/questions", response_model=Question, status_code=status.HTTP_201_CREATED)
def create_question(
    request: Request, payload: QuestionCreate, principal: Principal = Depends(get_admin_principal)
) -> Question:
    try:
        return repository(request).create_question(principal.organization_id, payload, audit_context(request, principal))
    except TopicNotFoundError as error:
        raise HTTPException(status_code=404, detail="Tópico não encontrado.") from error


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_question(request: Request, question_id: UUID, principal: Principal = Depends(get_admin_principal)) -> None:
    try:
        repository(request).delete_question(principal.organization_id, question_id, audit_context(request, principal))
    except QuestionNotFoundError as error:
        raise HTTPException(status_code=404, detail="Questão não encontrada.") from error


@router.post("/quiz/start", response_model=list[QuestionPublic])
def start_quiz(
    request: Request, payload: QuizStartRequest, principal: Principal = Depends(get_current_principal)
) -> list[QuestionPublic]:
    try:
        return repository(request).start_quiz(principal.organization_id, payload.topic_id, payload.quantity)
    except TopicNotFoundError as error:
        raise HTTPException(status_code=404, detail="Tópico não encontrado.") from error


@router.post("/quiz/submit", response_model=QuizResult)
def submit_quiz(
    request: Request, payload: QuizSubmission, principal: Principal = Depends(get_current_principal)
) -> QuizResult:
    try:
        total, correct, results = repository(request).grade_quiz(
            principal.organization_id,
            payload.topic_id,
            [(answer.question_id, answer.selected_option.value) for answer in payload.answers],
            audit_context(request, principal),
        )
    except QuestionNotFoundError as error:
        raise HTTPException(status_code=404, detail="Questão não encontrada.") from error
    return QuizResult(topic_id=payload.topic_id, total=total, correct=correct, results=results)


@router.post("/questions/draw", response_model=list[QuestionPublic])
def draw_questions(
    request: Request, payload: DrawRequest, principal: Principal = Depends(get_current_principal)
) -> list[QuestionPublic]:
    return repository(request).draw_questions(principal.organization_id, payload.topic_ids, payload.quantity)


@router.post("/questions/check", response_model=QuizAnswerResult)
def check_answer(
    request: Request, payload: QuizAnswer, principal: Principal = Depends(get_current_principal)
) -> QuizAnswerResult:
    try:
        result = repository(request).check_answer(
            principal.organization_id, payload.question_id, payload.selected_option.value
        )
    except QuestionNotFoundError as error:
        raise HTTPException(status_code=404, detail="Questão não encontrada.") from error
    return QuizAnswerResult(**result)


@router.post("/exams/submit", response_model=ExamResult)
def submit_exam(
    request: Request, payload: ExamSubmission, principal: Principal = Depends(get_current_principal)
) -> ExamResult:
    try:
        total, correct, results = repository(request).grade_exam(
            principal.organization_id,
            [(answer.question_id, answer.selected_option.value) for answer in payload.answers],
            payload.blank_question_ids,
            audit_context(request, principal),
        )
    except QuestionNotFoundError as error:
        raise HTTPException(status_code=404, detail="Questão não encontrada.") from error
    return ExamResult(total=total, correct=correct, blank=len(payload.blank_question_ids), results=results)


@router.get("/summary", response_model=ConcursosSummary)
def summary(request: Request, principal: Principal = Depends(get_current_principal)) -> ConcursosSummary:
    return repository(request).summary(principal.organization_id)


@router.get("/audit", response_model=list[AuditEvent])
def list_audit_events(
    request: Request,
    limit: int = Query(default=50, ge=1, le=200),
    principal: Principal = Depends(get_admin_principal),
) -> list[AuditEvent]:
    return repository(request).list_audit_events(principal.organization_id, limit)
