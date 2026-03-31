from __future__ import annotations

from app.models.case import CaseRecord
from app.models.result import CaseResult
from app.models.user import User
from app.schemas.case import CaseResponse
from app.schemas.inference import InferenceResult
from app.schemas.user import UserResponse


def build_overlay_url(case_id: str, channel: str, api_prefix: str) -> str:
    return f"{api_prefix}/cases/{case_id}/overlays/{channel}"


def build_case_image_url(case_id: str, api_prefix: str) -> str:
    return f"{api_prefix}/cases/{case_id}/image"


def build_inference_result(result: CaseResult, *, case_id: str, api_prefix: str) -> InferenceResult:
    overlay_urls = {
        channel: build_overlay_url(case_id, channel, api_prefix)
        for channel in sorted(result.overlay_paths)
    }
    return InferenceResult(
        grade=result.grade,
        grade_label=result.grade_label,
        referral_required=result.referral_required,
        referral_urgency=result.referral_urgency,
        referral_label=result.referral_label,
        confidence_tier=result.confidence_tier,
        confidence_score=round(result.confidence_score, 4),
        confidence_explanation=result.confidence_explanation,
        clinical_summary=result.clinical_summary,
        grade_probabilities=[round(value, 4) for value in result.grade_probabilities],
        lesion_presence=result.lesion_presence,
        lesion_confidence={key: round(value, 4) for key, value in result.lesion_confidence.items()},
        overlay_urls=overlay_urls,
        model_version=result.model_version,
        inference_time_ms=result.inference_time_ms,
        processed_at=result.processed_at,
    )


def build_case_response(case: CaseRecord, *, api_prefix: str) -> CaseResponse:
    result = case.result if case.status == "complete" else None

    return CaseResponse(
        case_id=case.id,
        patient_ref=case.patient_ref,
        eye_side=case.eye_side,
        notes=case.notes,
        status=case.status,
        created_at=case.created_at,
        image_url=build_case_image_url(case.id, api_prefix=api_prefix),
        result=build_inference_result(result, case_id=case.id, api_prefix=api_prefix) if result is not None else None,
    )


def build_user_response(user: User) -> UserResponse:
    return UserResponse(
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        institution=user.institution,
    )
