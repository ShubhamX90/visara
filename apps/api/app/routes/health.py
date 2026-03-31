from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Depends

from app.dependencies import get_model_handle
from app.schemas.health import HealthResponse
from app.services.inference.loader import ModelHandle

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", response_model=HealthResponse)
async def health(model_handle: ModelHandle = Depends(get_model_handle)) -> HealthResponse:
    return HealthResponse(
        status=model_handle.status,
        model_loaded=model_handle.model_loaded,
        model_version=model_handle.version,
        gpu_available=model_handle.gpu_available,
        timestamp=datetime.now(UTC),
    )
