import { LESION_CHANNELS, getGradeConfig } from "@/lib/constants";
import { createFundusImageDataUri } from "@/lib/mock-assets";
import type {
  ApiEyeSide,
  ApiLesionChannelId,
  CaseResponse,
  ConfidenceTier,
  DrGrade,
  LesionFinding,
} from "@/lib/types";

const apiToUiEyeSide: Record<ApiEyeSide, "OD" | "OS" | "OU"> = {
  left: "OS",
  right: "OD",
  both: "OU"
};

const uiToApiLesionChannel: Record<typeof LESION_CHANNELS[number]["id"], ApiLesionChannelId> = {
  ma: "ma",
  hard_exudates: "he",
  haemorrhages: "hem",
  soft_exudates: "se",
  irma: "irma",
  neovascularisation: "nv"
};

function confidenceFromScore(score: number): ConfidenceTier {
  if (score >= 0.7) {
    return "high";
  }
  if (score >= 0.45) {
    return "moderate";
  }
  return "low";
}

function buildLesionSummary(channel: ApiLesionChannelId, present: boolean, confidence: number) {
  if (!present) {
    return "No threshold-exceeding signal was highlighted in this lesion channel for the current image.";
  }

  const label = {
    ma: "Microaneurysm",
    he: "Hard exudate",
    hem: "Haemorrhage",
    se: "Soft exudate",
    irma: "IRMA",
    nv: "Neovascularisation"
  }[channel];

  return `${label} signal was highlighted with ${confidenceFromScore(confidence)} confidence in the current analysis.`;
}

export function buildCaseFallbackImage(caseId: string, grade: DrGrade) {
  const accentByGrade: Record<DrGrade, string> = {
    0: "#c47645",
    1: "#bf7a4b",
    2: "#d68153",
    3: "#cf7442",
    4: "#d47950"
  };

  return createFundusImageDataUri({
    accent: accentByGrade[grade],
    discX: 610 + caseId.length * 2,
    vesselColor: "#8c3a1a"
  });
}

export function buildCaseSummary(caseResponse: CaseResponse) {
  const grade = (caseResponse.result?.grade ?? 0) as DrGrade;

  return {
    capturedAt: caseResponse.result?.processed_at ?? caseResponse.created_at,
    confidence: caseResponse.result?.confidence_tier ?? "low",
    grade,
    id: caseResponse.case_id,
    laterality: apiToUiEyeSide[caseResponse.eye_side],
    patientReference: caseResponse.patient_ref,
    thumbnailSrc: buildCaseFallbackImage(caseResponse.case_id, grade)
  };
}

export function buildLesionFindings(caseResponse: CaseResponse): LesionFinding[] {
  const result = caseResponse.result;
  if (!result) {
    return [];
  }

  return LESION_CHANNELS.map((channel) => {
    const apiChannel = uiToApiLesionChannel[channel.id];
    const present = result.lesion_presence[apiChannel];
    const confidenceScore = result.lesion_confidence[apiChannel];

    return {
      ...channel,
      apiChannel,
      confidence: confidenceFromScore(confidenceScore),
      overlaySrc: result.overlay_urls[apiChannel],
      present,
      summary: buildLesionSummary(apiChannel, present, confidenceScore)
    };
  });
}

export function buildReferralReasons(caseResponse: CaseResponse) {
  const result = caseResponse.result;
  if (!result) {
    return ["Inference is still processing. A referral recommendation will appear shortly."];
  }

  const detectedLesionLabels: Record<ApiLesionChannelId, string> = {
    ma: "microaneurysms",
    he: "hard exudates",
    hem: "haemorrhages",
    se: "soft exudates",
    irma: "intraretinal microvascular abnormalities (IRMA)",
    nv: "neovascularisation"
  };

  const presentLesions = (Object.entries(result.lesion_presence) as [ApiLesionChannelId, boolean][])
    .filter(([, present]) => present)
    .map(([channel]) => detectedLesionLabels[channel]);

  const reasons: string[] = [];

  reasons.push(`The screening image analysis indicates ${result.grade_label}.`);

  if (presentLesions.length > 0) {
    const lesionList = presentLesions.slice(0, 3).join(", ");
    const suffix = presentLesions.length > 3 ? ` and ${presentLesions.length - 3} additional finding(s)` : "";
    reasons.push(`Lesion features identified include ${lesionList}${suffix}.`);
  } else {
    reasons.push("No lesion features exceeded the detection threshold in this image.");
  }

  reasons.push(`${result.referral_label}.`);
  return reasons;
}

export function buildDashboardStats(caseResponses: CaseResponse[]) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const casesToday = caseResponses.filter((caseResponse) => new Date(caseResponse.created_at) >= todayStart).length;
  const casesThisWeek = caseResponses.filter((caseResponse) => new Date(caseResponse.created_at) >= weekStart).length;
  const referralCases = caseResponses.filter((caseResponse) => caseResponse.result?.referral_required).length;
  const completedCases = caseResponses.filter((caseResponse) => caseResponse.result !== null);
  const averageTurnaroundMs =
    completedCases.length > 0
      ? completedCases.reduce((total, caseResponse) => total + (caseResponse.result?.inference_time_ms ?? 0), 0) / completedCases.length
      : 0;

  return {
    averageTurnaround: averageTurnaroundMs > 0 ? `${(averageTurnaroundMs / 1000).toFixed(1)} s` : "Pending",
    casesToday,
    casesThisWeek,
    referralRate: caseResponses.length > 0 ? `${Math.round((referralCases / caseResponses.length) * 100)}%` : "0%"
  };
}

export function getResultsHeadline(caseResponse: CaseResponse) {
  const grade = (caseResponse.result?.grade ?? 0) as DrGrade;
  return getGradeConfig(grade);
}
