from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import VisaraAPIError
from app.dependencies import get_current_user, get_db_session, get_report_generator
from app.models.user import User
from app.services.audit import record_audit_event
from app.services.cases import get_case_for_user
from app.services.reporting.pdf_generator import PDFReportGenerator

router = APIRouter(prefix="/cases", tags=["reports"])


@router.get("/{case_id}/report")
async def get_case_report(
    case_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db_session),
    report_generator: PDFReportGenerator = Depends(get_report_generator),
) -> Response:
    case = await get_case_for_user(session, case_id, current_user)
    if case.result is None or case.status != "complete":
        raise VisaraAPIError(
            code="REPORT_NOT_READY",
            message="A report is only available once inference is complete.",
            detail=f"Current case status is {case.status}.",
            status_code=409,
        )

    pdf_bytes = await report_generator.generate_case_report(case=case, result=case.result)
    record_audit_event(
        session,
        action="report.downloaded",
        user_id=current_user.id,
        case_id=case.id,
        metadata={"format": "pdf"},
    )
    await session.commit()
    headers = {
        "Content-Disposition": f'attachment; filename="{case.id}-report.pdf"',
    }
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
