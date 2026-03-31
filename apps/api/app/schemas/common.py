from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

EyeSide = Literal["left", "right", "both"]
CaseStatus = Literal["processing", "complete", "failed"]
ReferralUrgency = Literal["none", "routine", "urgent", "emergency"]
ConfidenceTier = Literal["high", "moderate", "low"]
UserRole = Literal["technician", "doctor", "admin"]
LesionChannel = Literal["ma", "he", "hem", "se", "irma", "nv"]


class APIModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class ErrorResponse(APIModel):
    code: str
    message: str
    detail: str | None = None


class MessageResponse(APIModel):
    message: str


class PaginationMeta(APIModel):
    page: int
    limit: int
    total: int


class Timestamped(APIModel):
    created_at: datetime
