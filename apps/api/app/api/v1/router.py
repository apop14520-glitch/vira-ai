from fastapi import APIRouter

from app.modules.business.router import router as business_router

router = APIRouter()
router.include_router(business_router, prefix="/business", tags=["business"])


@router.get("/", tags=["system"])
def api_version() -> dict[str, str]:
    """Expose the version namespace without exposing product data."""

    return {"service": "vira-api", "version": "v1"}
