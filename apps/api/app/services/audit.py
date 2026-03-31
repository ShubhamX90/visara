from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLogRecord


def record_audit_event(
    session: AsyncSession,
    *,
    action: str,
    user_id: str | None = None,
    case_id: str | None = None,
    metadata: dict[str, str] | None = None,
) -> None:
    session.add(
        AuditLogRecord(
            action=action,
            user_id=user_id,
            case_id=case_id,
            metadata_json=metadata,
        )
    )
