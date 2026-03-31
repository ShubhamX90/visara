from __future__ import annotations

from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.exceptions import VisaraAPIError
from app.models.case import CaseRecord
from app.models.result import CaseResult
from app.models.user import User
from app.schemas.case import CaseQueryParams


def _is_privileged_user(user: User) -> bool:
    return user.role in {"doctor", "admin"}


async def get_case_for_user(session: AsyncSession, case_id: str, user: User) -> CaseRecord:
    statement = (
        select(CaseRecord)
        .options(selectinload(CaseRecord.result), selectinload(CaseRecord.user))
        .where(CaseRecord.id == case_id)
    )
    case = await session.scalar(statement)

    if case is None:
        raise VisaraAPIError(
            code="CASE_NOT_FOUND",
            message="The requested case could not be found.",
            detail=f"No case exists for case_id={case_id}.",
            status_code=404,
        )

    if not _is_privileged_user(user) and case.user_id != user.id:
        raise VisaraAPIError(
            code="CASE_ACCESS_DENIED",
            message="You do not have access to this case.",
            detail="The case belongs to a different user.",
            status_code=403,
        )

    return case


def _apply_date_filters(
    statement,
    *,
    date_from: date | None,
    date_to: date | None,
):
    if date_from is not None:
        start = datetime.combine(date_from, time.min, tzinfo=UTC)
        statement = statement.where(CaseRecord.created_at >= start)

    if date_to is not None:
        end = datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=UTC)
        statement = statement.where(CaseRecord.created_at < end)

    return statement


async def list_cases_for_user(
    session: AsyncSession,
    *,
    user: User,
    params: CaseQueryParams,
) -> tuple[list[CaseRecord], int]:
    statement = select(CaseRecord).options(selectinload(CaseRecord.result), selectinload(CaseRecord.user))

    if not _is_privileged_user(user):
        statement = statement.where(CaseRecord.user_id == user.id)

    statement = _apply_date_filters(
        statement,
        date_from=params.date_from,
        date_to=params.date_to,
    )

    if params.grade_filter is not None or params.referral_filter is not None:
        statement = statement.join(CaseResult)

    if params.grade_filter is not None:
        statement = statement.where(CaseResult.grade == params.grade_filter)

    if params.referral_filter is not None:
        statement = statement.where(CaseResult.referral_urgency == params.referral_filter)

    count_statement = select(func.count()).select_from(statement.order_by(None).subquery())
    total = int(await session.scalar(count_statement) or 0)

    paginated_statement = (
        statement.order_by(CaseRecord.created_at.desc())
        .offset((params.page - 1) * params.limit)
        .limit(params.limit)
    )
    items = list(await session.scalars(paginated_statement))
    return items, total
