from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CaseResult(Base):
    __tablename__ = "results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    case_id: Mapped[str] = mapped_column(ForeignKey("cases.id", ondelete="CASCADE"), unique=True, index=True)
    grade: Mapped[int] = mapped_column(Integer)
    grade_label: Mapped[str] = mapped_column(String(128))
    referral_required: Mapped[bool] = mapped_column(Boolean)
    referral_urgency: Mapped[str] = mapped_column(String(32))
    referral_label: Mapped[str] = mapped_column(String(255))
    confidence_tier: Mapped[str] = mapped_column(String(32))
    confidence_score: Mapped[float] = mapped_column(Float)
    confidence_explanation: Mapped[str] = mapped_column(Text)
    grade_probabilities: Mapped[list[float]] = mapped_column(JSON)
    lesion_presence: Mapped[dict[str, bool]] = mapped_column(JSON)
    lesion_confidence: Mapped[dict[str, float]] = mapped_column(JSON)
    overlay_paths: Mapped[dict[str, str]] = mapped_column(JSON)
    clinical_summary: Mapped[str] = mapped_column(Text)
    model_version: Mapped[str] = mapped_column(String(255))
    inference_time_ms: Mapped[int] = mapped_column(Integer)
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))

    case = relationship("CaseRecord", back_populates="result")
