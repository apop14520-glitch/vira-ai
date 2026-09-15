"""Authentication and authorization boundary for the local API.

The development bypass is deliberately limited to the local-development
environment. Non-development environments require bearer tokens supplied by
runtime configuration; the contract can later be replaced by an identity
provider without changing Business route handlers.
"""

from dataclasses import dataclass
from hmac import compare_digest
from uuid import UUID

from fastapi import Depends, HTTPException, Request

from app.settings import Settings, get_settings


class AuthenticationError(Exception):
    """Raised when a request does not present valid runtime credentials."""


class AuthorizationError(Exception):
    """Raised when an authenticated principal lacks a required role."""


@dataclass(frozen=True)
class Principal:
    """Minimal authenticated identity passed to tenant-scoped operations."""

    actor_id: UUID
    organization_id: UUID
    roles: frozenset[str]

    def has_role(self, role: str) -> bool:
        return role in self.roles


def _matches_token(candidate: str | None, configured: object) -> bool:
    if not candidate or configured is None:
        return False
    configured_value = configured.get_secret_value() if hasattr(configured, "get_secret_value") else str(configured)
    return compare_digest(candidate.encode("utf-8"), configured_value.encode("utf-8"))


def _bearer_token(request: Request) -> str | None:
    authorization = request.headers.get("Authorization", "")
    scheme, separator, token = authorization.partition(" ")
    if not separator or scheme.casefold() != "bearer" or not token.strip():
        return None
    return token.strip()


def _runtime_settings(request: Request) -> Settings:
    """Read composed settings from the app while keeping unit tests lightweight."""

    app = getattr(request, "app", None)
    state = getattr(app, "state", app)
    return getattr(state, "settings", get_settings())


def _session_service(request: Request):
    app = getattr(request, "app", None)
    state = getattr(app, "state", app)
    return getattr(state, "admin_sessions", None)


def _session_principal(request: Request, settings: Settings) -> Principal:
    """Resolve the authenticated principal represented by the admin cookie."""

    raw_token = request.cookies.get(settings.admin_session_cookie_name)
    if not raw_token:
        raise AuthenticationError("Sessão administrativa necessária.")
    service = _session_service(request)
    if service is None:
        raise AuthenticationError("Sessão administrativa indisponível.")
    session = service.resolve_session(raw_token)
    if session is None:
        raise AuthenticationError("Sessão administrativa inválida.")
    try:
        organization_id = UUID(session.organization_id)
    except (TypeError, ValueError) as error:
        raise AuthenticationError("Sessão administrativa inválida.") from error
    return Principal(
        actor_id=settings.admin_actor_id,
        organization_id=organization_id,
        roles=frozenset({"operator", "admin"}),
    )


def authenticate_request(request: Request, settings: Settings) -> Principal:
    """Resolve a principal from the configured local or bearer-token policy."""

    authorization = request.headers.get("Authorization")
    token = _bearer_token(request)
    environment = settings.environment.strip().casefold()

    if environment == "development" and settings.allow_development_auth_bypass and not authorization:
        return Principal(
            actor_id=settings.development_actor_id,
            organization_id=settings.development_organization_id,
            roles=frozenset({"operator", "admin"}),
        )

    if authorization and token is None:
        raise AuthenticationError("Cabeçalho de autenticação inválido.")
    if token is None:
        raise AuthenticationError("Autenticação necessária para acessar este recurso.")

    organization_id = settings.auth_organization_id or settings.development_organization_id
    if _matches_token(token, settings.admin_access_token):
        return Principal(
            actor_id=settings.admin_actor_id,
            organization_id=organization_id,
            roles=frozenset({"operator", "admin"}),
        )
    if _matches_token(token, settings.api_access_token):
        return Principal(
            actor_id=settings.api_actor_id,
            organization_id=organization_id,
            roles=frozenset({"operator"}),
        )
    raise AuthenticationError("Token de acesso inválido.")


def get_current_principal(request: Request) -> Principal:
    """FastAPI dependency that converts auth failures into safe HTTP errors."""

    try:
        settings = _runtime_settings(request)
        if request.cookies.get(settings.admin_session_cookie_name):
            return _session_principal(request, settings)
        return authenticate_request(request, settings)
    except AuthenticationError as error:
        raise HTTPException(
            status_code=401,
            detail=str(error),
            headers={"WWW-Authenticate": "Bearer"},
        ) from error


def get_current_session_principal(request: Request) -> Principal:
    """Require a valid administrative session, never a development bypass."""

    try:
        return _session_principal(request, _runtime_settings(request))
    except AuthenticationError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


def require_admin(principal: Principal = Depends(get_current_principal)) -> Principal:
    """Require an authenticated principal with the administrative role."""

    if not principal.has_role("admin"):
        raise AuthorizationError("Apenas administradores podem alterar esta integração.")
    return principal


def get_admin_principal(principal: Principal = Depends(get_current_principal)) -> Principal:
    """FastAPI dependency that converts missing admin role into HTTP 403."""

    try:
        return require_admin(principal)
    except AuthorizationError as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
