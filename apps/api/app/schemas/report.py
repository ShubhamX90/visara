from __future__ import annotations

from app.schemas.common import APIModel


class ReportMetadata(APIModel):
    filename: str
    content_type: str = "application/pdf"
