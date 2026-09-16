"""Administrative login and session endpoints."""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from starlette.responses import JSONResponse

from app.modules.business.repository import AuditContext
from app.modules.identity.domain import AdminSession
from app.modules.identity.schemas import (
    InitialSetupRequest,
    InitialSetupStatusResponse,
    LoginRequest,
    LoginResponse,
    PasswordChangeRequest,
    SessionResponse,
)
from app.security.auth import Principal, get_current_session_principal
from app.security.rate_limit import SlidingWindowRateLimiter
from app.security.sessions import (
    AdminSessionService,
    InitialSetupAlreadyCompleted,
    InitialSetupNotConfigured,
    InitialSetupRejected,
    PasswordChangeError,
)
from app.settings import Settings


router = APIRouter()
GENERIC_LOGIN_ERROR = "Não foi possível autenticar."
GENERIC_SESSION_ERROR = "Sessão administrativa inválida."


def _settings(request: Request) -> Settings:
    return request.app.state.settings


def _service(request: Request) -> AdminSessionService:
    return request.app.state.admin_sessions


def _limiter(request: Request) -> SlidingWindowRateLimiter:
    return request.app.state.identity_rate_limiter


def _request_id(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")


def _organization_id(settings: Settings) -> UUID:
    return settings.auth_organization_id or settings.development_organization_id


def _session_principal_context(request: Request, session: AdminSession) -> Principal:
    settings = _settings(request)
    return Principal(
        actor_id=settings.admin_actor_id,
        organization_id=UUID(session.organization_id),
        roles=frozenset({"operator", "admin"}),
    )


def _audit(
    request: Request,
    *,
    action: str,
    organization_id: UUID,
    actor_id: UUID | str,
    outcome: str = "success",
) -> None:
    audit_repository = getattr(request.app.state, "company_leads", None)
    if audit_repository is None:
        return
    audit_repository.record_audit_event(
        organization_id=organization_id,
        action=action,
        resource_type="admin_identity",
        resource_id=_settings(request).admin_actor_id,
        audit_context=AuditContext(actor_id=actor_id, request_id=_request_id(request)),
        metadata={},
        outcome=outcome,
    )


def _rate_key(request: Request, username: str) -> str:
    host = request.client.host if request.client else "unknown"
    return f"{host}:{username.casefold()}"


def _set_session_cookie(response: Response, settings: Settings, raw_token: str) -> None:
    response.set_cookie(
        key=settings.admin_session_cookie_name,
        value=raw_token,
        max_age=settings.admin_session_ttl_seconds,
        httponly=True,
        secure=settings.environment.strip().casefold() not in {"development", "test"},
        samesite="lax",
        path="/",
    )


def _clear_session_cookie(response: Response, settings: Settings) -> None:
    response.delete_cookie(
        key=settings.admin_session_cookie_name,
        httponly=True,
        secure=settings.environment.strip().casefold() not in {"development", "test"},
        samesite="lax",
        path="/",
    )


def _current_session(request: Request) -> AdminSession | None:
    settings = _settings(request)
    raw_token = request.cookies.get(settings.admin_session_cookie_name)
    return _service(request).resolve_session(raw_token)


@router.get("/setup-status", response_model=InitialSetupStatusResponse, tags=["identity"])
def initial_setup_status(request: Request) -> InitialSetupStatusResponse:
    settings = _settings(request)
    return InitialSetupStatusResponse(
        required=_service(request).initial_setup_required(),
        configured=settings.admin_setup_token is not None,
    )


@router.post("/setup", response_model=LoginResponse, tags=["identity"])
def initial_setup(payload: InitialSetupRequest, request: Request) -> JSONResponse:
    settings = _settings(request)
    key = f"setup:{_rate_key(request, payload.username)}"
    limiter = _limiter(request)
    if not limiter.allow(key):
        raise HTTPException(
            status_code=429,
            detail="Muitas tentativas. Aguarde antes de tentar novamente.",
            headers={"Retry-After": str(limiter.retry_after(key))},
        )

    try:
        credential = _service(request).create_initial_credential(
            payload.username,
            payload.password,
            payload.confirmation,
            payload.setup_token,
        )
    except InitialSetupRejected as error:
        raise HTTPException(status_code=401, detail=str(error)) from error
    except InitialSetupAlreadyCompleted as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    except InitialSetupNotConfigured as error:
        raise HTTPException(status_code=412, detail=str(error)) from error

    _, raw_token = _service(request).create_session(credential)
    _audit(
        request,
        action="admin_initial_setup_succeeded",
        organization_id=UUID(credential.organization_id),
        actor_id=settings.admin_actor_id,
    )
    response = JSONResponse(content={"authenticated": True, "username": credential.username})
    _set_session_cookie(response, settings, raw_token)
    return response


@router.post("/login", response_model=LoginResponse, tags=["identity"])
def login(payload: LoginRequest, request: Request) -> JSONResponse:
    settings = _settings(request)
    key = _rate_key(request, payload.username)
    limiter = _limiter(request)
    if not limiter.allow(key):
        raise HTTPException(
            status_code=429,
            detail="Muitas tentativas. Aguarde antes de tentar novamente.",
            headers={"Retry-After": str(limiter.retry_after(key))},
        )

    credential = _service(request).authenticate(payload.username, payload.password)
    if credential is None:
        _audit(
            request,
            action="admin_login_failed",
            organization_id=_organization_id(settings),
            actor_id="anonymous",
            outcome="rejected",
        )
        raise HTTPException(status_code=401, detail=GENERIC_LOGIN_ERROR)

    _, raw_token = _service(request).create_session(credential)
    _audit(
        request,
        action="admin_login_succeeded",
        organization_id=UUID(credential.organization_id),
        actor_id=settings.admin_actor_id,
    )
    response = JSONResponse(content={"authenticated": True, "username": credential.username})
    _set_session_cookie(response, settings, raw_token)
    return response


@router.get("/session", response_model=SessionResponse, tags=["identity"])
def session(
    request: Request,
    principal: Principal = Depends(get_current_session_principal),
) -> SessionResponse:
    current = _current_session(request)
    if current is None:
        raise HTTPException(status_code=401, detail=GENERIC_SESSION_ERROR)
    return SessionResponse(
        authenticated=True,
        username=current.username,
        organization_id=str(principal.organization_id),
    )


@router.post("/logout", status_code=204, tags=["identity"])
def logout(request: Request) -> Response:
    settings = _settings(request)
    current = _current_session(request)
    if current is not None:
        principal = _session_principal_context(request, current)
        _service(request).revoke_session(current)
        _audit(
            request,
            action="admin_logout",
            organization_id=principal.organization_id,
            actor_id=principal.actor_id,
        )
    response = Response(status_code=204)
    _clear_session_cookie(response, settings)
    return response


@router.put("/password", status_code=204, tags=["identity"])
def change_password(
    payload: PasswordChangeRequest,
    request: Request,
    principal: Principal = Depends(get_current_session_principal),
) -> Response:
    settings = _settings(request)
    current = _current_session(request)
    if current is None:
        raise HTTPException(status_code=401, detail=GENERIC_SESSION_ERROR)
    try:
        _service(request).change_password(
            current,
            payload.current_password,
            payload.new_password,
            payload.confirmation,
        )
    except PasswordChangeError as error:
        _audit(
            request,
            action="admin_password_change_failed",
            organization_id=principal.organization_id,
            actor_id=principal.actor_id,
            outcome="rejected",
        )
        raise HTTPException(status_code=400, detail=str(error)) from error

    _audit(
        request,
        action="admin_password_changed",
        organization_id=principal.organization_id,
        actor_id=principal.actor_id,
    )
    response = Response(status_code=204)
    _clear_session_cookie(response, settings)
    return response
