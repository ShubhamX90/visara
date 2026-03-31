from __future__ import annotations

from collections.abc import AsyncIterator
from datetime import UTC, datetime

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import Settings
from app.core.exceptions import VisaraAPIError
from app.core.security import decode_token
from app.database import get_session_from_maker
from app.models.session import SessionRecord
from app.models.user import User
from app.services.inference.loader import ModelHandle
from app.services.inference.service import InferenceService
from app.services.reporting.pdf_generator import PDFReportGenerator
from app.services.rate_limit import InMemoryRateLimiter
from app.services.storage.base import StorageBackend

bearer_scheme = HTTPBearer(auto_error=False)


def _ensure_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


def get_app_settings(request: Request) -> Settings:
    return request.app.state.settings


async def get_db_session(request: Request) -> AsyncIterator[AsyncSession]:
    async for session in get_session_from_maker(request.app.state.session_maker):
        yield session


def get_storage(request: Request) -> StorageBackend:
    return request.app.state.storage


def get_inference_service(request: Request) -> InferenceService:
    return request.app.state.inference_service


def get_report_generator(request: Request) -> PDFReportGenerator:
    return request.app.state.report_generator


def get_model_handle(request: Request) -> ModelHandle:
    return request.app.state.model_handle


def get_case_submission_rate_limiter(request: Request) -> InMemoryRateLimiter:
    return request.app.state.case_submission_rate_limiter


async def get_current_session(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_app_settings),
) -> SessionRecord:
    if credentials is None:
        raise VisaraAPIError(
            code="AUTHENTICATION_REQUIRED",
            message="Authentication is required for this endpoint.",
            detail="Provide a valid bearer token.",
            status_code=401,
        )

    try:
        payload = decode_token(
            token=credentials.credentials,
            secret=settings.jwt_secret,
            algorithm=settings.jwt_algorithm,
        )
    except jwt.PyJWTError as exc:
        raise VisaraAPIError(
            code="INVALID_TOKEN",
            message="The provided access token is invalid.",
            detail=str(exc),
            status_code=401,
        ) from exc

    session_id = str(payload.get("sid", ""))
    user_id = str(payload.get("sub", ""))

    statement = (
        select(SessionRecord)
        .options(selectinload(SessionRecord.user))
        .where(SessionRecord.id == session_id)
    )
    session_record = await session.scalar(statement)

    if session_record is None or session_record.user is None:
        raise VisaraAPIError(
            code="SESSION_NOT_FOUND",
            message="The current session could not be found.",
            detail="Please log in again.",
            status_code=401,
        )

    now = datetime.now(UTC)
    if session_record.revoked_at is not None:
        raise VisaraAPIError(
            code="SESSION_REVOKED",
            message="This session has been logged out.",
            detail="Please authenticate again to continue.",
            status_code=401,
        )

    if _ensure_utc(session_record.expires_at) <= now:
        raise VisaraAPIError(
            code="SESSION_EXPIRED",
            message="The access token has expired.",
            detail="Please log in again.",
            status_code=401,
        )

    if session_record.user.id != user_id:
        raise VisaraAPIError(
            code="TOKEN_SUBJECT_MISMATCH",
            message="The token payload does not match the current session.",
            detail="Please authenticate again.",
            status_code=401,
        )

    return session_record


async def get_current_user(
    session_record: SessionRecord = Depends(get_current_session),
) -> User:
    return session_record.user


async def enforce_case_submission_rate_limit(
    current_user: User = Depends(get_current_user),
    rate_limiter: InMemoryRateLimiter = Depends(get_case_submission_rate_limiter),
) -> None:
    await rate_limiter.enforce(key=current_user.id)
