from fastapi import APIRouter

from app.modules.business.router import router as business_router
from app.modules.concursos.router import router as concursos_router
from app.modules.identity.router import router as identity_router

router = APIRouter()
router.include_router(business_router, prefix="/business", tags=["business"])
router.include_router(concursos_router, prefix="/concursos", tags=["concursos"])
router.include_router(identity_router, prefix="/auth", tags=["identity"])


@router.get("/", tags=["system"])
def api_version() -> dict[str, str]:
    """Expose the version namespace without exposing product data."""

    return {"service": "vira-api", "version": "v1"}
