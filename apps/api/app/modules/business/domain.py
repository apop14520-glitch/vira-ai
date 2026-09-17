"""Business-domain contracts deliberately limited to company information."""

from datetime import datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class LeadStatus(StrEnum):
    NOVO = "novo"
    QUALIFICADO = "qualificado"
    EM_CONVERSA = "em_conversa"
    PROPOSTA = "proposta"
    GANHO = "ganho"
    PERDIDO = "perdido"


class LeadPriority(StrEnum):
    ALTA = "alta"
    NORMAL = "normal"
    BAIXA = "baixa"


class LeadTemperature(StrEnum):
    QUENTE = "quente"
    MORNO = "morno"
    FRIO = "frio"


class WebsiteStatus(StrEnum):
    NAO_VERIFICADO = "nao_verificado"
    INFORMADO = "informado"
    AUSENTE = "ausente"


class CompanyLeadCreate(BaseModel):
    """Minimum viable company lead. Personal contacts are intentionally absent."""

    company_name: str = Field(min_length=2, max_length=160)
    segment: str = Field(min_length=2, max_length=100)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=2)
    website: str | None = Field(default=None, max_length=240)
    website_status: WebsiteStatus = WebsiteStatus.NAO_VERIFICADO
    source: str = Field(default="manual", min_length=2, max_length=100)
    priority: LeadPriority = LeadPriority.NORMAL
    temperature: LeadTemperature = LeadTemperature.MORNO
    external_place_id: str | None = Field(default=None, max_length=100)

    @field_validator("company_name", "segment", "city", "source")
    @classmethod
    def strip_text(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("O campo não pode ficar vazio.")
        return value

    @field_validator("state")
    @classmethod
    def normalize_state(cls, value: str) -> str:
        value = value.strip().upper()
        if len(value) != 2 or not value.isalpha():
            raise ValueError("Informe a sigla UF com duas letras.")
        return value

    @field_validator("website")
    @classmethod
    def normalize_website(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        normalized = value.strip().lower()
        if not normalized.startswith(("https://", "http://")):
            raise ValueError("O site deve começar com http:// ou https://.")
        return normalized


class LeadStatusUpdate(BaseModel):
    status: LeadStatus
    version: int = Field(ge=1)


class CompanyLead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    lead_number: int
    organization_id: UUID
    company_name: str
    segment: str
    city: str
    state: str
    website: str | None
    website_status: WebsiteStatus
    source: str
    source_type: str
    purpose: str
    status: LeadStatus
    priority: LeadPriority
    temperature: LeadTemperature
    external_place_id: str | None
    version: int
    created_at: datetime
    updated_at: datetime


class BusinessSummary(BaseModel):
    total: int
    by_status: dict[LeadStatus, int]


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
