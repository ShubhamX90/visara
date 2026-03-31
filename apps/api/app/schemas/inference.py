from __future__ import annotations

from datetime import datetime

from pydantic import Field, field_validator

from app.schemas.common import APIModel, ConfidenceTier, ReferralUrgency


class InferenceResult(APIModel):
    grade: int = Field(ge=0, le=4)
    grade_label: str
    referral_required: bool
    referral_urgency: ReferralUrgency
    referral_label: str
    confidence_tier: ConfidenceTier
    confidence_score: float = Field(ge=0.0, le=1.0)
    confidence_explanation: str
    clinical_summary: str
    grade_probabilities: list[float] = Field(min_length=5, max_length=5)
    lesion_presence: dict[str, bool]
    lesion_confidence: dict[str, float]
    overlay_urls: dict[str, str]
    model_version: str
    inference_time_ms: int = Field(ge=0)
    processed_at: datetime

    @staticmethod
    def _validate_keys(value: dict[str, object], *, field_name: str) -> dict[str, object]:
        expected_keys = {"ma", "he", "hem", "se", "irma", "nv"}
        if set(value) != expected_keys:
            raise ValueError(f"{field_name} must include exactly the keys ma, he, hem, se, irma, nv")
        return value

    @field_validator("grade_probabilities")
    @classmethod
    def validate_probabilities(cls, value: list[float]) -> list[float]:
        total = sum(value)
        if abs(total - 1.0) > 1e-3:
            raise ValueError(
                f"grade_probabilities must sum to approximately 1.0 (got {total:.6f})"
            )
        return value

    @field_validator("lesion_presence")
    @classmethod
    def validate_lesion_presence(cls, value: dict[str, bool]) -> dict[str, bool]:
        return cls._validate_keys(value, field_name="lesion_presence")

    @field_validator("lesion_confidence")
    @classmethod
    def validate_lesion_confidence(cls, value: dict[str, float]) -> dict[str, float]:
        validated = cls._validate_keys(value, field_name="lesion_confidence")
        if any(score < 0.0 or score > 1.0 for score in value.values()):
            raise ValueError("lesion_confidence values must be between 0.0 and 1.0")
        return validated  # type: ignore[return-value]

    @field_validator("overlay_urls")
    @classmethod
    def validate_overlay_urls(cls, value: dict[str, str]) -> dict[str, str]:
        valid_keys = {"ma", "he", "hem", "se", "irma", "nv"}
        invalid_keys = set(value) - valid_keys
        if invalid_keys:
            raise ValueError(f"overlay_urls contains unknown channel keys: {invalid_keys}")
        if any(not overlay_url for overlay_url in value.values()):
            raise ValueError("overlay_urls values must not be empty strings")
        return value
