from __future__ import annotations

import math

import torch

from app.services.inference.postprocess import postprocess


def build_outputs(*, ce_logits: list[float], ord_logits: list[float], pres_logits: list[float]) -> dict[str, object]:
    return {
        "logits_ord": torch.tensor([ord_logits], dtype=torch.float32),
        "logits_ce": torch.tensor([ce_logits], dtype=torch.float32),
        "logits_pres": torch.tensor([pres_logits], dtype=torch.float32),
        "seg_logits": torch.zeros((1, 6, 4, 4), dtype=torch.float32),
    }


def test_postprocess_grade_referral_and_high_confidence() -> None:
    outputs = build_outputs(
        ce_logits=[0.1, 0.4, 3.5, 0.2, -0.3],
        ord_logits=[0.8, 0.2, -0.2, -0.9],
        pres_logits=[2.0, 1.5, -2.0, -2.0, -2.0, -2.0],
    )

    result = postprocess(outputs, model_version="visara-v3", inference_time_ms=1234)

    assert result.grade == 2
    assert result.grade_label == "Moderate NPDR"
    assert result.referral_required is True
    assert result.referral_urgency == "routine"
    assert result.referral_label == "Ophthalmologist referral recommended"
    assert result.confidence_tier == "high"
    assert math.isclose(sum(result.grade_probabilities), 1.0, rel_tol=0.0, abs_tol=1e-6)
    assert result.lesion_presence["ma"] is True
    assert result.lesion_presence["he"] is True
    assert result.lesion_presence["hem"] is False


def test_postprocess_confidence_tier_thresholds() -> None:
    moderate_outputs = build_outputs(
        ce_logits=[0.1, 0.2, 1.6, 0.0, -0.3],
        ord_logits=[0.4, 0.1, -0.1, -0.3],
        pres_logits=[-2.0, -2.0, -2.0, -2.0, -2.0, -2.0],
    )
    low_outputs = build_outputs(
        ce_logits=[0.2, 0.22, 0.21, 0.19, 0.18],
        ord_logits=[0.1, 0.0, -0.1, -0.2],
        pres_logits=[-2.0, -2.0, -2.0, -2.0, -2.0, -2.0],
    )

    moderate_result = postprocess(moderate_outputs, model_version="visara-v3", inference_time_ms=900)
    low_result = postprocess(low_outputs, model_version="visara-v3", inference_time_ms=950)

    assert moderate_result.confidence_tier == "moderate"
    assert low_result.confidence_tier == "low"


def test_postprocess_non_referable_grade_maps_to_no_referral() -> None:
    outputs = build_outputs(
        ce_logits=[3.0, 1.0, 0.4, -0.2, -0.4],
        ord_logits=[-0.8, -1.1, -1.4, -1.8],
        pres_logits=[-2.0, -2.0, -2.0, -2.0, -2.0, -2.0],
    )

    result = postprocess(outputs, model_version="visara-v3", inference_time_ms=777)

    assert result.grade == 0
    assert result.referral_required is False
    assert result.referral_urgency == "none"
    assert result.referral_label == "No specialist referral required at this time"
