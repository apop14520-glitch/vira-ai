"""FastAPI application entrypoint for the VIRA.AI foundation."""

import logging
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel

from app.api.v1.router import router as v1_router
from app.db.factory import create_database
from app.modules.business.repository import SQLiteCompanyLeadRepository
from app.modules.business.places import FoursquarePlacesService
from app.observability.logging import configure_logging
from app.settings import get_settings


class HealthResponse(BaseModel):
    """Stable response contract used by local and deployment health checks."""

    status: str
    service: str


class ErrorPayload(BaseModel):
    code: str
    message: str
    request_id: str


class ErrorResponse(BaseModel):
    error: ErrorPayload


settings = get_settings()
configure_logging(settings.log_level)
logger = logging.getLogger("vira-api")

@asynccontextmanager
async def lifespan(application: FastAPI):
    """Initialize local infrastructure without leaking it into route code."""

    database = create_database(settings.database_url)
    database.initialize()
    company_leads = SQLiteCompanyLeadRepository(database)
    company_leads.initialize_schema()
    application.state.company_leads = company_leads
    application.state.foursquare_places = FoursquarePlacesService(
        settings.foursquare_api_key.get_secret_value() if settings.foursquare_api_key else None
    )
    yield
    database.close()


app = FastAPI(
    title="VIRA.AI API",
    version="0.1.0",
    description="Base modular da API do ecossistema VIRA.AI.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Request-ID"],
)


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Attach a bounded correlation ID to each request and response."""

    async def dispatch(self, request: Request, call_next):
        incoming = request.headers.get("X-Request-ID", "")
        request_id = incoming[:128] if incoming and incoming.isprintable() else str(uuid4())
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Apply low-risk browser security defaults to every response."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response


app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestContextMiddleware)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    request_id = getattr(request.state, "request_id", "unknown")
    logger.info("request_validation_failed", extra={"request_id": request_id})
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": "A requisição contém dados inválidos.",
                "request_id": request_id,
            }
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = getattr(request.state, "request_id", "unknown")
    detail = exc.detail if isinstance(exc.detail, str) else "A requisição não pôde ser processada."
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": "HTTP_ERROR",
                "message": detail,
                "request_id": request_id,
            }
        },
    )


app.include_router(v1_router, prefix="/api/v1")


@app.get("/health", response_model=HealthResponse, tags=["system"])
def healthcheck() -> HealthResponse:
    """Report that the API process is running.

    This endpoint deliberately does not expose database, provider or user
    information. Dependency-specific readiness checks can be added later.
    """

    return HealthResponse(status="ok", service="vira-api")
