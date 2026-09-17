"""HTTP boundary for the VIRA Business local-development module."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, field_validator

from app.modules.business.domain import AuditEvent, BusinessSummary, CompanyLead, CompanyLeadCreate, LeadStatus, LeadStatusUpdate
from app.modules.business.places import (
    FoursquarePlacesService,
    PlaceSearchInput,
    PlacesNotConfiguredError,
    PlacesProviderError,
    serialize_place,
)
from app.modules.business.repository import AuditContext, LeadAlreadyExistsError, LeadNotFoundError, LeadVersionConflictError, SQLiteCompanyLeadRepository
from app.security.auth import Principal, get_admin_principal, get_current_principal
from app.security.rate_limit import SlidingWindowRateLimiter

router = APIRouter()


class FoursquareConfigStatus(BaseModel):
    configured: bool
    mode: str
    message: str


class FoursquareKeyUpdate(BaseModel):
    api_key: str | None = Field(default=None, max_length=2048)
    clear: bool = False

    @field_validator("api_key")
    @classmethod
    def strip_key(cls, value: str | None) -> str | None:
        return value.strip() if value else value


class PlaceSearchRequest(BaseModel):
    establishment_name: str = Field(min_length=2, max_length=100)
    city: str = Field(min_length=2, max_length=100)
    state: str = Field(min_length=2, max_length=2)
    quantity: int = Field(default=20, ge=1, le=20)

    @field_validator("establishment_name", "city")
    @classmethod
    def strip_search_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("state")
    @classmethod
    def normalize_search_state(cls, value: str) -> str:
        value = value.strip().upper()
        if not value.isalpha():
            raise ValueError("Informe a sigla UF com duas letras.")
        return value


class PlaceSearchResponse(BaseModel):
    place_id: str
    name: str
    segment: str
    city: str
    state: str
    address: str | None
    website: str | None
    website_status: str
    source: str


def places_service(request: Request) -> FoursquarePlacesService:
    return request.app.state.foursquare_places


def repository(request: Request) -> SQLiteCompanyLeadRepository:
    return request.app.state.company_leads


def audit_context(request: Request, principal: Principal) -> AuditContext:
    return AuditContext(actor_id=principal.actor_id, request_id=getattr(request.state, "request_id", "unknown"))


def rate_limiter(request: Request) -> SlidingWindowRateLimiter:
    return request.app.state.foursquare_rate_limiter


@router.get("/leads", response_model=list[CompanyLead])
def list_company_leads(
    request: Request,
    status_filter: LeadStatus | None = Query(default=None, alias="status"),
    query: str | None = Query(default=None, max_length=100),
    principal: Principal = Depends(get_current_principal),
) -> list[CompanyLead]:
    return repository(request).list(principal.organization_id, status_filter, query)


@router.post("/leads", response_model=CompanyLead, status_code=status.HTTP_201_CREATED)
def create_company_lead(request: Request, payload: CompanyLeadCreate, principal: Principal = Depends(get_current_principal)) -> CompanyLead:
    try:
        return repository(request).create(principal.organization_id, payload, audit_context(request, principal))
    except LeadAlreadyExistsError as error:
        raise HTTPException(status_code=409, detail="Essa empresa já existe para esta cidade.") from error


@router.patch("/leads/{lead_id}/status", response_model=CompanyLead)
def update_company_lead_status(
    request: Request,
    lead_id: UUID,
    payload: LeadStatusUpdate,
    principal: Principal = Depends(get_current_principal),
) -> CompanyLead:
    try:
        return repository(request).update_status(principal.organization_id, lead_id, payload, audit_context(request, principal))
    except LeadNotFoundError as error:
        raise HTTPException(status_code=404, detail="Empresa não encontrada.") from error
    except LeadVersionConflictError as error:
        raise HTTPException(status_code=409, detail="O dado foi alterado em outra sessão. Atualize a lista e tente novamente.") from error


@router.delete("/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_company_lead(request: Request, lead_id: UUID, principal: Principal = Depends(get_current_principal)) -> None:
    try:
        repository(request).delete(principal.organization_id, lead_id, audit_context(request, principal))
    except LeadNotFoundError as error:
        raise HTTPException(status_code=404, detail="Empresa não encontrada.") from error


@router.get("/summary", response_model=BusinessSummary)
def business_summary(request: Request, principal: Principal = Depends(get_current_principal)) -> BusinessSummary:
    return repository(request).summary(principal.organization_id)


@router.get("/audit", response_model=list[AuditEvent])
def list_audit_events(
    request: Request,
    limit: int = Query(default=50, ge=1, le=200),
    principal: Principal = Depends(get_admin_principal),
) -> list[AuditEvent]:
    return repository(request).list_audit_events(principal.organization_id, limit)


@router.get("/integrations/foursquare", response_model=FoursquareConfigStatus)
def foursquare_status(request: Request, principal: Principal = Depends(get_current_principal)) -> FoursquareConfigStatus:
    service = places_service(request)
    return FoursquareConfigStatus(
        configured=service.configured,
        mode=service.configuration_mode,
        message="A chave nunca é retornada pela API." if service.configured else "Configure uma Service Key para buscar locais.",
    )


@router.put("/integrations/foursquare", response_model=FoursquareConfigStatus)
def update_foursquare_key(
    request: Request,
    payload: FoursquareKeyUpdate,
    principal: Principal = Depends(get_admin_principal),
) -> FoursquareConfigStatus:
    service = places_service(request)
    if payload.clear:
        service.clear_runtime_key()
        action = "integration.foursquare.cleared"
    elif payload.api_key:
        service.set_runtime_key(payload.api_key)
        action = "integration.foursquare.configured"
    else:
        raise HTTPException(status_code=422, detail="Informe uma chave ou marque a opção de remover.")
    repository(request).record_audit_event(
        principal.organization_id,
        action,
        "integration",
        "foursquare",
        audit_context(request, principal),
        {"mode": service.configuration_mode},
    )
    return foursquare_status(request)


@router.post("/places/search", response_model=list[PlaceSearchResponse])
async def search_foursquare_places(
    request: Request,
    payload: PlaceSearchRequest,
    principal: Principal = Depends(get_current_principal),
) -> list[PlaceSearchResponse]:
    limiter = rate_limiter(request)
    context = audit_context(request, principal)
    if not limiter.allow(str(principal.actor_id)):
        repository(request).record_audit_event(
            principal.organization_id,
            "integration.foursquare.search",
            "integration",
            "foursquare",
            context,
            {"quantity_requested": payload.quantity},
            "rate_limited",
        )
        raise HTTPException(
            status_code=429,
            detail="Limite de buscas atingido. Aguarde antes de tentar novamente.",
            headers={"Retry-After": str(limiter.retry_after(str(principal.actor_id)))},
        )
    try:
        results = await places_service(request).search(
            PlaceSearchInput(payload.establishment_name, payload.city, payload.state, payload.quantity)
        )
    except PlacesNotConfiguredError as error:
        repository(request).record_audit_event(
            principal.organization_id,
            "integration.foursquare.search",
            "integration",
            "foursquare",
            context,
            {"quantity_requested": payload.quantity},
            "rejected",
        )
        raise HTTPException(status_code=412, detail="Configure a chave da Foursquare antes de buscar locais.") from error
    except PlacesProviderError as error:
        repository(request).record_audit_event(
            principal.organization_id,
            "integration.foursquare.search",
            "integration",
            "foursquare",
            context,
            {"quantity_requested": payload.quantity},
            "failed",
        )
        raise HTTPException(status_code=502, detail=str(error)) from error
    repository(request).record_audit_event(
        principal.organization_id,
        "integration.foursquare.search",
        "integration",
        "foursquare",
        context,
        {"quantity_requested": payload.quantity, "result_count": len(results)},
    )
    return [PlaceSearchResponse(**serialize_place(result)) for result in results]
