from __future__ import annotations

import uuid
from datetime import date

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.exceptions import VisaraAPIError
from app.dependencies import (
    get_app_settings,
    enforce_case_submission_rate_limit,
    get_current_user,
    get_db_session,
    get_inference_service,
    get_storage,
)
from app.models.case import CaseRecord
from app.models.user import User
from app.schemas.case import CaseListResponse, CaseQueryParams, CaseResponse
from app.schemas.common import EyeSide, ReferralUrgency
from app.services.audit import record_audit_event
from app.services.cases import get_case_for_user, list_cases_for_user
from app.services.inference.service import InferenceService
from app.services.presenters import build_case_response
from app.services.storage.base import StorageBackend

router = APIRouter(prefix="/cases", tags=["cases"])


@router.post("", response_model=CaseResponse, status_code=201)
async def create_case(
    patient_ref: str = Form(...),
    eye_side: EyeSide = Form(...),
    notes: str | None = Form(default=None),
    image: UploadFile = File(...),
    _: None = Depends(enforce_case_submission_rate_limit),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_app_settings),
    storage: StorageBackend = Depends(get_storage),
    inference_service: InferenceService = Depends(get_inference_service),
) -> CaseResponse:
    patient_ref = patient_ref.strip()
    if not patient_ref:
        raise VisaraAPIError(
            code="PATIENT_REFERENCE_REQUIRED",
            message="A patient reference is required.",
            detail="Use a non-identifying reference number rather than a patient name.",
            status_code=400,
        )

    filename = image.filename or "upload.bin"
    content_type = image.content_type or "application/octet-stream"
    payload = await image.read()
    if not payload:
        raise VisaraAPIError(
            code="EMPTY_FILE",
            message="The uploaded file is empty.",
            detail="Please upload a valid fundus image or DICOM file.",
            status_code=400,
        )

    validated_content_type = storage.validate_upload(
        filename=filename,
        content_type=content_type,
        payload=payload,
        max_upload_size_bytes=settings.max_upload_size_bytes,
    )

    case_id = str(uuid.uuid4())
    stored_file = await storage.save_case_upload(
        case_id=case_id,
        filename=filename,
        content_type=validated_content_type,
        payload=payload,
    )

    case = CaseRecord(
        id=case_id,
        user_id=current_user.id,
        patient_ref=patient_ref,
        eye_side=eye_side,
        notes=notes.strip() if notes else None,
        status="processing",
        image_storage_path=stored_file.relative_path,
        image_original_filename=stored_file.original_filename,
        image_content_type=stored_file.content_type,
        image_size_bytes=stored_file.size_bytes,
    )
    session.add(case)
    record_audit_event(
        session,
        action="case.created",
        user_id=current_user.id,
        case_id=case.id,
        metadata={"eye_side": case.eye_side, "patient_ref": case.patient_ref},
    )
    await session.commit()
    await session.refresh(case)

    inference_service.schedule_case_inference(case.id)
    return build_case_response(case, api_prefix=settings.api_prefix)


@router.get("/{case_id}", response_model=CaseResponse)
async def get_case(
    case_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_app_settings),
) -> CaseResponse:
    case = await get_case_for_user(session, case_id, current_user)
    return build_case_response(case, api_prefix=settings.api_prefix)


@router.get("", response_model=CaseListResponse)
async def list_cases(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    grade_filter: int | None = Query(default=None, ge=0, le=4),
    referral_filter: ReferralUrgency | None = Query(default=None),
    date_from: date | None = Query(default=None),
    date_to: date | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_app_settings),
) -> CaseListResponse:
    params = CaseQueryParams(
        page=page,
        limit=limit,
        grade_filter=grade_filter,
        referral_filter=referral_filter,
        date_from=date_from,
        date_to=date_to,
    )
    items, total = await list_cases_for_user(session, user=current_user, params=params)
    return CaseListResponse(
        items=[build_case_response(case, api_prefix=settings.api_prefix) for case in items],
        pagination={"page": params.page, "limit": params.limit, "total": total},
    )


@router.get("/{case_id}/overlays/{channel}")
async def get_overlay(
    case_id: str,
    channel: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    storage: StorageBackend = Depends(get_storage),
) -> Response:
    case = await get_case_for_user(session, case_id, current_user)
    if case.result is None or channel not in case.result.overlay_paths:
        raise VisaraAPIError(
            code="OVERLAY_NOT_FOUND",
            message="The requested lesion overlay is not available.",
            detail=f"No overlay exists for channel={channel}.",
            status_code=404,
        )

    return Response(
        content=await storage.read_bytes(case.result.overlay_paths[channel]),
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename="{case.id}-{channel}.png"'},
    )


@router.get("/{case_id}/image")
async def get_case_image(
    case_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    storage: StorageBackend = Depends(get_storage),
) -> Response:
    case = await get_case_for_user(session, case_id, current_user)
    return Response(
        content=await storage.read_bytes(case.image_storage_path),
        media_type=case.image_content_type or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{case.image_original_filename}"'},
    )
