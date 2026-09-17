"""Concursos-domain contracts: a question bank plus a simple study/quiz mode."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class QuestionDifficulty(StrEnum):
    FACIL = "facil"
    MEDIA = "media"
    DIFICIL = "dificil"


class QuestionOption(StrEnum):
    A = "a"
    B = "b"
    C = "c"
    D = "d"


class TopicCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=500)

    @field_validator("name")
    @classmethod
    def strip_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("O nome do tópico não pode ficar vazio.")
        return value

    @field_validator("description")
    @classmethod
    def strip_description(cls, value: str) -> str:
        return value.strip()


class Topic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    name: str
    description: str
    question_count: int
    created_at: datetime


class QuestionCreate(BaseModel):
    """A multiple-choice question with exactly four options."""

    topic_id: UUID
    statement: str = Field(min_length=5, max_length=4000)
    option_a: str = Field(min_length=1, max_length=500)
    option_b: str = Field(min_length=1, max_length=500)
    option_c: str = Field(min_length=1, max_length=500)
    option_d: str = Field(min_length=1, max_length=500)
    correct_option: QuestionOption
    explanation: str = Field(default="", max_length=2000)
    difficulty: QuestionDifficulty = QuestionDifficulty.MEDIA
    source: str = Field(default="manual", max_length=200)

    @field_validator("statement", "option_a", "option_b", "option_c", "option_d")
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("O campo não pode ficar vazio.")
        return value

    @field_validator("explanation", "source")
    @classmethod
    def strip_optional_text(cls, value: str) -> str:
        return value.strip()


class Question(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    topic_id: UUID
    statement: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    correct_option: QuestionOption
    explanation: str
    difficulty: QuestionDifficulty
    source: str
    created_at: datetime


class QuestionPublic(BaseModel):
    """Question projection shown during a quiz — never carries the answer key."""

    id: UUID
    topic_id: UUID
    statement: str
    option_a: str
    option_b: str
    option_c: str
    option_d: str
    difficulty: QuestionDifficulty


class QuizAnswer(BaseModel):
    question_id: UUID
    selected_option: QuestionOption


class QuizSubmission(BaseModel):
    topic_id: UUID
    answers: list[QuizAnswer] = Field(min_length=1, max_length=100)


class QuizAnswerResult(BaseModel):
    question_id: UUID
    selected_option: QuestionOption
    correct_option: QuestionOption
    is_correct: bool
    explanation: str


class QuizResult(BaseModel):
    topic_id: UUID
    total: int
    correct: int
    results: list[QuizAnswerResult]


class ConcursosSummary(BaseModel):
    total_topics: int
    total_questions: int
    by_topic: dict[str, int]


class AuditEvent(BaseModel):
    """Read-only, privacy-safe projection of a recorded audit event."""

    id: UUID
    actor_id: str
    action: str
    resource_type: str
    resource_id: str
    occurred_at: datetime
    outcome: str
    metadata: dict[str, object]
