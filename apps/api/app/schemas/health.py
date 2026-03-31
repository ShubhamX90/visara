from __future__ import annotations

from datetime import datetime

from app.schemas.common import APIModel


class HealthResponse(APIModel):
    status: str
    model_loaded: bool
    model_version: str
    gpu_available: bool
    timestamp: datetime
