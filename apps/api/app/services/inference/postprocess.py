from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from app.services.inference.confidence import get_confidence_context, score_to_confidence_tier
from app.services.inference.predict import LESION_CHANNELS

REFERRAL_LABELS = {
    0: "No specialist referral required at this time",
    1: "No specialist referral required at this time",
    2: "Ophthalmologist referral recommended",
    3: "Urgent ophthalmologist referral recommended",
    4: "Emergency retina referral recommended",
}

GRADE_LABELS = {
    0: "No DR",
    1: "Mild NPDR",
    2: "Moderate NPDR",
    3: "Severe NPDR",
    4: "PDR",
}

REFERRAL_URGENCY = {
    0: "none",
    1: "none",
    2: "routine",
    3: "urgent",
    4: "emergency",
}

LESION_SUMMARY_NAMES = {
    "ma": "microaneurysms",
    "he": "hard exudates",
    "hem": "haemorrhages",
    "se": "soft exudates",
    "irma": "IRMA",
    "nv": "neovascularisation",
}


@dataclass(slots=True)
class PostprocessedInference:
    grade: int
    grade_label: str
    referral_required: bool
    referral_urgency: str
    referral_label: str
    confidence_tier: str
    confidence_score: float
    confidence_explanation: str
    clinical_summary: str
    grade_probabilities: list[float]
    lesion_presence: dict[str, bool]
    lesion_confidence: dict[str, float]
    model_version: str
    inference_time_ms: int
    processed_at: datetime


def _enforce_monotone(cumulative_probabilities):
    import torch

    reversed_values = torch.flip(cumulative_probabilities, dims=[0])
    monotone_reversed = torch.cummax(reversed_values, dim=0).values
    return torch.flip(monotone_reversed, dims=[0])


def _ordinal_grade_probabilities(logits_ord) -> list[float]:
    import torch

    cumulative = torch.sigmoid(logits_ord / 0.686)
    cumulative = _enforce_monotone(cumulative)
    probabilities = torch.stack(
        [
            1.0 - cumulative[0],
            cumulative[0] - cumulative[1],
            cumulative[1] - cumulative[2],
            cumulative[2] - cumulative[3],
            cumulative[3],
        ]
    )
    probabilities = torch.clamp(probabilities, min=0.0)
    total = float(probabilities.sum().item())
    if total <= 0:
        return [0.2] * 5
    return [float(value) / total for value in probabilities.tolist()]


def _build_clinical_summary(
    *,
    grade: int,
    confidence_explanation: str,
    lesion_presence: dict[str, bool],
) -> str:
    present_lesions = [LESION_SUMMARY_NAMES[channel] for channel, present in lesion_presence.items() if present]

    if present_lesions:
        lesion_clause = ", ".join(present_lesions[:3])
        return (
            f"The current image features are consistent with {GRADE_LABELS[grade]} and highlighted signal in {lesion_clause}. "
            f"{confidence_explanation} Clinical interpretation should remain anchored to the original fundus image."
        )

    return (
        f"The current image does not highlight a strong lesion burden beyond a {GRADE_LABELS[grade]} pattern. "
        f"{confidence_explanation} Clinical correlation remains important."
    )


def postprocess(
    outputs: dict[str, object],
    *,
    model_version: str,
    inference_time_ms: int,
) -> PostprocessedInference:
    import torch

    logits_ord = outputs["logits_ord"][0]
    logits_ce = outputs["logits_ce"][0]
    logits_pres = outputs["logits_pres"][0]

    ce_probabilities = torch.softmax(logits_ce, dim=-1)
    grade = int(torch.argmax(ce_probabilities).item())
    confidence_score = float(ce_probabilities.max().item())
    confidence_tier = score_to_confidence_tier(confidence_score)
    confidence_explanation = get_confidence_context(confidence_tier, grade)

    grade_probabilities = _ordinal_grade_probabilities(logits_ord)
    lesion_probabilities = torch.sigmoid(logits_pres)
    lesion_confidence = {
        channel: float(probability)
        for channel, probability in zip(LESION_CHANNELS, lesion_probabilities.tolist(), strict=True)
    }
    lesion_presence = {
        channel: confidence >= 0.5
        for channel, confidence in lesion_confidence.items()
    }

    return PostprocessedInference(
        grade=grade,
        grade_label=GRADE_LABELS[grade],
        referral_required=grade >= 2,
        referral_urgency=REFERRAL_URGENCY[grade],
        referral_label=REFERRAL_LABELS[grade],
        confidence_tier=confidence_tier,
        confidence_score=confidence_score,
        confidence_explanation=confidence_explanation,
        clinical_summary=_build_clinical_summary(
            grade=grade,
            confidence_explanation=confidence_explanation,
            lesion_presence=lesion_presence,
        ),
        grade_probabilities=grade_probabilities,
        lesion_presence=lesion_presence,
        lesion_confidence=lesion_confidence,
        model_version=model_version,
        inference_time_ms=inference_time_ms,
        processed_at=datetime.now(UTC),
    )
