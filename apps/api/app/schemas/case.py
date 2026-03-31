from __future__ import annotations

from datetime import date, datetime

from pydantic import Field

from app.schemas.common import APIModel, CaseStatus, EyeSide, PaginationMeta, ReferralUrgency
from app.schemas.inference import InferenceResult


class CaseResponse(APIModel):
    case_id: str
    patient_ref: str
    eye_side: EyeSide
    notes: str | None = None
    status: CaseStatus
    created_at: datetime
    image_url: str
    result: InferenceResult | None = None


class CaseListResponse(APIModel):
    items: list[CaseResponse]
    pagination: PaginationMeta


class CaseQueryParams(APIModel):
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=10, ge=1, le=100)
    grade_filter: int | None = Field(default=None, ge=0, le=4)
    referral_filter: ReferralUrgency | None = None
    date_from: date | None = None
    date_to: date | None = None
