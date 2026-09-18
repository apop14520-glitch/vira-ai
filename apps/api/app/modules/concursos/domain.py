"""Concursos-domain contracts: a question bank plus a simple study/quiz mode."""

from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class QuestionDifficulty(StrEnum):
    FACIL = "facil"
    MEDIA = "media"
    DIFICIL = "dificil"


class QuestionOption(StrEnum):
    A = "a"
    B = "b"
    C = "c"
    D = "d"
    E = "e"


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
    has_theory: bool = False
    created_at: datetime


class QuestionCreate(BaseModel):
    """A multiple-choice question with four required options and an optional fifth (E)."""

    topic_id: UUID
    statement: str = Field(min_length=5, max_length=4000)
    option_a: str = Field(min_length=1, max_length=500)
    option_b: str = Field(min_length=1, max_length=500)
    option_c: str = Field(min_length=1, max_length=500)
    option_d: str = Field(min_length=1, max_length=500)
    option_e: str | None = Field(default=None, max_length=500)
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
    option_e: str | None
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
    option_e: str | None
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


class DrawRequest(BaseModel):
    """Ask for a random set of questions; no topics means the whole bank."""

    topic_ids: list[UUID] = Field(default_factory=list, max_length=100)
    quantity: int = Field(default=10, ge=1, le=100)


class ExamSubmission(BaseModel):
    """Answers of an exam; questions left unanswered are listed apart so they still count."""

    answers: list[QuizAnswer] = Field(default_factory=list, max_length=100)
    blank_question_ids: list[UUID] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def require_some_question(self) -> "ExamSubmission":
        if not self.answers and not self.blank_question_ids:
            raise ValueError("O simulado precisa ter ao menos uma questão.")
        return self


class ExamAnswerResult(BaseModel):
    question_id: UUID
    selected_option: QuestionOption | None
    correct_option: QuestionOption
    is_correct: bool
    explanation: str


class ExamResult(BaseModel):
    """Result of an exam that may span several topics; blanks count as not correct."""

    total: int
    correct: int
    blank: int
    results: list[ExamAnswerResult]


class TheoryParagraph(BaseModel):
    type: Literal["paragraph"]
    text: str = Field(min_length=1, max_length=4000)


class TheoryDefinition(BaseModel):
    """Termo com a sua definição curta (uma frase)."""

    type: Literal["definition"]
    term: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=2000)


class TheoryCallout(BaseModel):
    """Caixa de destaque do manual ("Importante lembrar!")."""

    type: Literal["callout"]
    text: str = Field(min_length=1, max_length=2000)


class TheoryTable(BaseModel):
    type: Literal["table"]
    caption: str = Field(default="", max_length=200)
    header: list[Annotated[str, Field(max_length=300)]] = Field(min_length=1, max_length=10)
    rows: list[list[Annotated[str, Field(max_length=500)]]] = Field(min_length=1, max_length=60)

    @model_validator(mode="after")
    def rows_match_header(self) -> "TheoryTable":
        if any(len(row) != len(self.header) for row in self.rows):
            raise ValueError("Toda linha da tabela precisa ter o mesmo número de colunas do cabeçalho.")
        return self


TheoryBlock = Annotated[
    TheoryParagraph | TheoryDefinition | TheoryCallout | TheoryTable, Field(discriminator="type")
]


class TheorySection(BaseModel):
    heading: str = Field(default="", max_length=200)
    blocks: list[TheoryBlock] = Field(min_length=1, max_length=60)


class TheoryChapter(BaseModel):
    number: str = Field(default="", max_length=10)
    title: str = Field(min_length=1, max_length=200)
    objective: str = Field(default="", max_length=1000)
    sections: list[TheorySection] = Field(min_length=1, max_length=40)
    review: list[Annotated[str, Field(min_length=1, max_length=1000)]] = Field(default_factory=list, max_length=30)


class TheoryDocument(BaseModel):
    """Teoria de um tópico, importada do manual: capítulos, seções e blocos tipados."""

    summary: str = Field(default="", max_length=2000)
    sources: str = Field(default="", max_length=2000)
    chapters: list[TheoryChapter] = Field(min_length=1, max_length=40)


class TheoryImportResult(BaseModel):
    topic_id: UUID
    chapters: int
    updated_at: datetime


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
