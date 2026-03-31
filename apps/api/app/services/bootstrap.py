from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, AsyncSession

from app.config import Settings
from app.core.security import hash_password
from app.models.user import User


async def _ensure_user(
    *,
    session: AsyncSession,
    email: str,
    password: str,
    full_name: str,
    role: str,
) -> None:
    existing = await session.scalar(select(User).where(User.email == email))
    if existing is not None:
        return

    session.add(
        User(
            email=email,
            full_name=full_name,
            role=role,
            institution="BITS Pilani Research Project",
            password_hash=hash_password(password),
        )
    )


async def seed_default_users(
    session_maker: async_sessionmaker[AsyncSession],
    settings: Settings,
) -> None:
    async with session_maker() as session:
        await _ensure_user(
            session=session,
            email=settings.demo_doctor_email,
            password=settings.demo_doctor_password,
            full_name=settings.demo_doctor_name,
            role="doctor",
        )
        await _ensure_user(
            session=session,
            email=settings.demo_technician_email,
            password=settings.demo_technician_password,
            full_name=settings.demo_technician_name,
            role="technician",
        )
        await _ensure_user(
            session=session,
            email=settings.demo_admin_email,
            password=settings.demo_admin_password,
            full_name=settings.demo_admin_name,
            role="admin",
        )
        await session.commit()
