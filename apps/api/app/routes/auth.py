from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.core.exceptions import VisaraAPIError
from app.core.security import create_access_token, verify_password
from app.dependencies import get_app_settings, get_current_session, get_current_user, get_db_session
from app.models.session import SessionRecord
from app.models.user import User
from app.schemas.common import MessageResponse
from app.services.audit import record_audit_event
from app.schemas.user import AuthTokenResponse, LoginRequest, UserResponse
from app.services.presenters import build_user_response

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=AuthTokenResponse)
async def login(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_db_session),
    settings: Settings = Depends(get_app_settings),
) -> AuthTokenResponse:
    user = await session.scalar(select(User).where(User.email == payload.email.lower()))

    if user is None or not verify_password(payload.password, user.password_hash):
        raise VisaraAPIError(
            code="INVALID_CREDENTIALS",
            message="Email or password is incorrect.",
            detail="Please verify your institutional credentials and try again.",
            status_code=status.HTTP_401_UNAUTHORIZED,
        )

    session_record = SessionRecord(
        user_id=user.id,
        expires_at=datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes),
    )
    session.add(session_record)
    await session.flush()

    access_token, expires_at = create_access_token(
        secret=settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
        user_id=user.id,
        session_id=session_record.id,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
    )
    session_record.expires_at = expires_at
    record_audit_event(
        session,
        action="auth.login",
        user_id=user.id,
        metadata={"email": user.email},
    )
    await session.commit()

    return AuthTokenResponse(access_token=access_token)


@router.post("/logout", response_model=MessageResponse)
async def logout(
    current_session: SessionRecord = Depends(get_current_session),
    session: AsyncSession = Depends(get_db_session),
) -> MessageResponse:
    active_session = await session.get(SessionRecord, current_session.id)
    if active_session is None:
        raise VisaraAPIError(
            code="SESSION_NOT_FOUND",
            message="No active session was found to log out.",
            detail="The current token may already be revoked.",
            status_code=status.HTTP_404_NOT_FOUND,
        )

    active_session.revoked_at = datetime.now(UTC)
    await session.commit()
    return MessageResponse(message="Logout successful.")


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return build_user_response(current_user)
