import type {
  ConfidenceTier,
  DrGrade,
  EyeSide,
  InferenceStepId,
  LesionOverlay,
  ReferralUrgency
} from "@/lib/types";

export const CLINICAL_DISCLAIMER =
  "This tool is a clinical decision-support system. All clinical decisions remain the responsibility of the treating physician.";

export const EYE_SIDE_LABELS: Record<EyeSide, string> = {
  OD: "Right Eye",
  OS: "Left Eye",
  OU: "Both Eyes"
};

export const GRADE_CONFIG: Record<
  DrGrade,
  {
    badgeLabel: string;
    headline: string;
    referral: ReferralUrgency;
    tone: "green" | "amber" | "orange" | "red";
    referralTitle: string;
    referralSummary: string;
  }
> = {
  0: {
    badgeLabel: "Non-referable",
    headline: "No DR / Mild DR - Routine Monitoring",
    referral: "non_referable",
    tone: "green",
    referralTitle: "No specialist referral required at this time",
    referralSummary:
      "Findings are consistent with a non-referable screening outcome. Continue routine monitoring and clinical follow-up."
  },
  1: {
    badgeLabel: "Non-referable",
    headline: "No DR / Mild DR - Routine Monitoring",
    referral: "non_referable",
    tone: "green",
    referralTitle: "No specialist referral required at this time",
    referralSummary:
      "Findings are consistent with a non-referable screening outcome. Continue routine monitoring and clinical follow-up."
  },
  2: {
    badgeLabel: "Moderate DR - Refer",
    headline: "Moderate DR - Refer",
    referral: "refer",
    tone: "amber",
    referralTitle: "Ophthalmologist referral recommended",
    referralSummary:
      "Features suggest moderate diabetic retinopathy. A specialist review is recommended to confirm severity and plan follow-up."
  },
  3: {
    badgeLabel: "Severe DR - Refer Urgently",
    headline: "Severe DR - Refer Urgently",
    referral: "urgent",
    tone: "orange",
    referralTitle: "Urgent ophthalmologist referral recommended",
    referralSummary:
      "Features are consistent with severe diabetic retinopathy. Prompt specialist assessment is recommended."
  },
  4: {
    badgeLabel: "PDR - Emergency Referral",
    headline: "PDR - Emergency Referral",
    referral: "emergency",
    tone: "red",
    referralTitle: "Emergency retina referral recommended",
    referralSummary:
      "Features are consistent with proliferative diabetic retinopathy. Emergency specialist evaluation is recommended."
  }
};

export const CONFIDENCE_CONFIG: Record<
  ConfidenceTier,
  {
    label: string;
    description: string;
    tone: "green" | "amber" | "red";
  }
> = {
  high: {
    label: "High confidence",
    description: "Prediction is well supported by image quality and lesion pattern consistency.",
    tone: "green"
  },
  moderate: {
    label: "Moderate confidence",
    description: "Prediction is usable, though borderline features may benefit from confirmatory review.",
    tone: "amber"
  },
  low: {
    label: "Low confidence",
    description: "Consider specialist review because image quality or lesion visibility limits certainty.",
    tone: "red"
  }
};

export const LESION_CHANNELS: LesionOverlay[] = [
  {
    id: "ma",
    shortLabel: "MA",
    label: "Microaneurysms",
    color: "rgba(255,165,0,0.55)",
    swatch: "#FFA500",
    description: "Small focal vascular outpouchings, often the earliest visible DR sign."
  },
  {
    id: "hard_exudates",
    shortLabel: "HE",
    label: "Hard Exudates",
    color: "rgba(255,255,0,0.55)",
    swatch: "#D4C400",
    description: "Lipid deposits that can cluster around areas of leakage."
  },
  {
    id: "haemorrhages",
    shortLabel: "HEM",
    label: "Haemorrhages",
    color: "rgba(220,20,60,0.55)",
    swatch: "#DC143C",
    description: "Intraretinal bleeding suggestive of vascular damage."
  },
  {
    id: "soft_exudates",
    shortLabel: "SE",
    label: "Soft Exudates",
    color: "rgba(144,238,144,0.55)",
    swatch: "#90EE90",
    description: "Cotton-wool spots indicating focal ischemic change."
  },
  {
    id: "irma",
    shortLabel: "IRMA",
    label: "IRMA",
    color: "rgba(147,112,219,0.55)",
    swatch: "#9370DB",
    description: "Intraretinal microvascular abnormalities associated with advanced non-proliferative disease."
  },
  {
    id: "neovascularisation",
    shortLabel: "NV",
    label: "Neovascularisation",
    color: "rgba(255,20,147,0.55)",
    swatch: "#FF1493",
    description: "Fragile new vessel growth associated with proliferative disease."
  }
];

export const INFERENCE_STEPS: Array<{ id: InferenceStepId; label: string; helper: string }> = [
  {
    id: "preprocessing",
    label: "Preprocessing image",
    helper: "Checking resolution, preparing the retinal field, and preserving the original image."
  },
  {
    id: "analysis",
    label: "Running AI analysis",
    helper: "Estimating grade, referral urgency, and lesion presence."
  },
  {
    id: "overlays",
    label: "Generating overlays",
    helper: "Building lesion maps so the predicted regions remain reviewable."
  },
  {
    id: "results",
    label: "Preparing results",
    helper: "Organising the report surface, confidence language, and next-step summary."
  }
];

export const REFERRAL_STATUS_LABELS: Record<ReferralUrgency, string> = {
  non_referable: "Routine monitoring",
  refer: "Refer",
  urgent: "Refer urgently",
  emergency: "Emergency referral"
};

export const UPLOAD_QUALITY_REQUIREMENTS = [
  "Use a full-quality colour fundus image with the posterior pole clearly visible.",
  "Avoid heavy blur, eyelid or eyelash occlusion, and severe underexposure.",
  "Center the optic disc and macular region as cleanly as the imaging protocol allows.",
  "Retain the original capture resolution whenever possible for downstream review."
] as const;

export const MODEL_LIMITATIONS = [
  "This interface is not an autonomous diagnostic system and should not replace specialist assessment.",
  "Performance can degrade when the fundus image is poorly focused, cropped, or obscured.",
  "The output should be interpreted alongside the clinical examination and any additional imaging.",
  "Lesion overlays are explainability aids and may not correspond to every clinically relevant feature."
] as const;

export function getGradeConfig(grade: DrGrade) {
  return GRADE_CONFIG[grade];
}

export function getReferralTone(grade: DrGrade) {
  return GRADE_CONFIG[grade].tone;
}
