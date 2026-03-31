from __future__ import annotations

from app.schemas.common import ConfidenceTier


def score_to_confidence_tier(score: float) -> ConfidenceTier:
    if score >= 0.70:
        return "high"
    if score >= 0.45:
        return "moderate"
    return "low"


def get_confidence_context(tier: ConfidenceTier, grade: int) -> str:
    grade_context = {
        0: "a non-referable retinal screen",
        1: "mild non-referable diabetic retinopathy findings",
        2: "Moderate DR findings",
        3: "Severe DR findings",
        4: "proliferative diabetic retinopathy findings",
    }[grade]

    if tier == "high":
        return f"High confidence — the model's analysis is consistent with {grade_context}."
    if tier == "moderate":
        return f"Moderate confidence — the model suggests {grade_context}, though confirmatory clinical review remains appropriate."
    return "Low confidence — image quality or unusual presentation may affect accuracy. Clinical review is recommended."
