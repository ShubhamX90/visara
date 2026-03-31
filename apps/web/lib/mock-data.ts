import { CONFIDENCE_CONFIG, LESION_CHANNELS, MODEL_LIMITATIONS } from "@/lib/constants";
import { createFundusImageDataUri, createOverlayDataUri } from "@/lib/mock-assets";
import type {
  AppUser,
  ApiEyeSide,
  ApiLesionChannelId,
  CaseRecord,
  CaseResponse,
  CaseSummary,
  ConfidenceTier,
  DashboardStats,
  EyeSide,
  InferenceResult,
  LesionChannelId,
  LesionFinding,
  ModelMetric,
  ModelStatus,
  SettingToggle,
  ValidationFact
} from "@/lib/types";

export const heroFundusImage = createFundusImageDataUri();

const uiToApiLesionChannel: Record<LesionChannelId, ApiLesionChannelId> = {
  ma: "ma",
  hard_exudates: "he",
  haemorrhages: "hem",
  soft_exudates: "se",
  irma: "irma",
  neovascularisation: "nv"
};

const overlaySources = Object.fromEntries(
  LESION_CHANNELS.map((channel) => [channel.id, createOverlayDataUri(channel.id, channel.swatch)])
) as Record<LesionChannelId, string>;

export const lesionOverlayDemo = LESION_CHANNELS.map((channel) => ({
  ...channel,
  overlaySrc: overlaySources[channel.id]
}));

function buildLesionFindings(
  config: Partial<Record<LesionChannelId, { present: boolean; confidence: ConfidenceTier; summary: string }>>
): LesionFinding[] {
  return LESION_CHANNELS.map((channel) => {
    const definition = config[channel.id];

    return {
      ...channel,
      apiChannel: uiToApiLesionChannel[channel.id],
      overlaySrc: overlaySources[channel.id],
      present: definition?.present ?? false,
      confidence: definition?.confidence ?? "low",
      summary:
        definition?.summary ??
        "No convincing lesion signal was highlighted in this channel on the current review image."
    };
  });
}

function createCaseRecord(config: {
  id: string;
  patientReference: string;
  capturedAt: string;
  receivedAt: string;
  processedAt: string;
  grade: 0 | 1 | 2 | 3 | 4;
  confidence: ConfidenceTier;
  laterality: EyeSide;
  accent: string;
  discX: number;
  vesselColor: string;
  findings: string[];
  clinicalExplanation: string;
  qualitySummary: string;
  notes?: string;
  captureDevice: string;
  lesionConfig: Partial<Record<LesionChannelId, { present: boolean; confidence: ConfidenceTier; summary: string }>>;
}) {
  const originalImageSrc = createFundusImageDataUri({
    accent: config.accent,
    discX: config.discX,
    vesselColor: config.vesselColor
  });

  return {
    id: config.id,
    patientReference: config.patientReference,
    capturedAt: config.capturedAt,
    receivedAt: config.receivedAt,
    processedAt: config.processedAt,
    grade: config.grade,
    confidence: config.confidence,
    laterality: config.laterality,
    thumbnailSrc: originalImageSrc,
    originalImageSrc,
    modelVersion: "visara-v3",
    captureDevice: config.captureDevice,
    qualitySummary: config.qualitySummary,
    clinicalExplanation: config.clinicalExplanation,
    findings: config.findings,
    notes: config.notes,
    lesionFindings: buildLesionFindings(config.lesionConfig)
  } satisfies CaseRecord;
}

export const mockCurrentUser: AppUser = {
  name: "Dr. Saumya Agarwal",
  email: "saumya.agarwal@bits-pilani.ac.in",
  role: "Retina Screening Reviewer",
  initials: "SA",
  institution: "BITS Pilani Research Project"
};

export const dashboardStats: DashboardStats = {
  casesToday: 14,
  casesThisWeek: 63,
  referralRate: "31%",
  averageTurnaround: "11.4 s"
};

export const modelStatus: ModelStatus = {
  version: "visara-v3",
  lastUpdated: "2026-03-29T10:15:00.000Z",
  operationalStatus: "operational",
  summary: "Inference service is operational, calibrated, and ready for new screening cases."
};

export const allCases: CaseRecord[] = [
  createCaseRecord({
    id: "VIS-260331-008",
    patientReference: "PT-9234",
    capturedAt: "2026-03-31T11:10:00.000Z",
    receivedAt: "2026-03-31T11:08:00.000Z",
    processedAt: "2026-03-31T11:10:12.000Z",
    grade: 3,
    confidence: "high",
    laterality: "OD",
    accent: "#cf7442",
    discX: 628,
    vesselColor: "#8f341a",
    findings: [
      "Multiple haemorrhagic regions are highlighted inferior and temporal to the macula.",
      "IRMA signal is present in the superior arcade, increasing concern for advanced non-proliferative disease.",
      "Overall lesion burden supports an urgent referral pathway rather than routine follow-up."
    ],
    clinicalExplanation:
      "The image shows a cluster of haemorrhages, microaneurysms, and vascular abnormalities consistent with severe diabetic retinopathy. The suggested referral is urgent because the lesion burden and vascular changes are more advanced than a routine-monitoring result.",
    qualitySummary: "Image quality is high with clear posterior pole visibility and minimal peripheral shadowing.",
    notes: "Technician noted stable fixation and no major media opacity during capture.",
    captureDevice: "Topcon NW400 fundus camera",
    lesionConfig: {
      ma: {
        present: true,
        confidence: "high",
        summary: "Clustered microaneurysm signal is present adjacent to the temporal arcade."
      },
      hard_exudates: {
        present: true,
        confidence: "moderate",
        summary: "Hard exudate signal is visible near the macular region."
      },
      haemorrhages: {
        present: true,
        confidence: "high",
        summary: "Haemorrhage regions are highlighted in multiple temporal and inferior locations."
      },
      soft_exudates: {
        present: false,
        confidence: "low",
        summary: "No strong cotton-wool spot pattern was emphasised in this image."
      },
      irma: {
        present: true,
        confidence: "moderate",
        summary: "Vascular irregularity in the superior arcade is consistent with IRMA signal."
      },
      neovascularisation: {
        present: false,
        confidence: "low",
        summary: "No convincing proliferative neovascular pattern was highlighted."
      }
    }
  }),
  createCaseRecord({
    id: "VIS-260331-006",
    patientReference: "PT-9218",
    capturedAt: "2026-03-31T09:36:00.000Z",
    receivedAt: "2026-03-31T09:34:00.000Z",
    processedAt: "2026-03-31T09:36:11.000Z",
    grade: 2,
    confidence: "high",
    laterality: "OS",
    accent: "#d68153",
    discX: 612,
    vesselColor: "#8a3418",
    findings: [
      "Microaneurysm and hard exudate overlays cluster temporal to the foveal region.",
      "No convincing proliferative pattern is highlighted in the current image.",
      "The referral recommendation is driven by a moderate but reviewable lesion burden."
    ],
    clinicalExplanation:
      "The highlighted findings suggest moderate diabetic retinopathy with lesions that remain clinically interpretable on the original fundus image. A specialist referral is recommended to confirm severity and guide follow-up scheduling.",
    qualitySummary: "Image quality is high with strong illumination and preserved vessel detail.",
    notes: "Previous visit recorded six months earlier. No procedure notes entered for this session.",
    captureDevice: "Canon CR-2 AF",
    lesionConfig: {
      ma: {
        present: true,
        confidence: "high",
        summary: "Microaneurysm signal is concentrated near the posterior pole."
      },
      hard_exudates: {
        present: true,
        confidence: "moderate",
        summary: "Exudate clusters are visible temporal to the macula."
      },
      haemorrhages: {
        present: true,
        confidence: "moderate",
        summary: "Small haemorrhagic foci are present but less extensive than in severe disease."
      }
    }
  }),
  createCaseRecord({
    id: "VIS-260330-014",
    patientReference: "PT-9182",
    capturedAt: "2026-03-30T15:20:00.000Z",
    receivedAt: "2026-03-30T15:18:00.000Z",
    processedAt: "2026-03-30T15:20:09.000Z",
    grade: 0,
    confidence: "moderate",
    laterality: "OD",
    accent: "#bf6a40",
    discX: 604,
    vesselColor: "#85361b",
    findings: [
      "No convincing referable lesion burden was highlighted in the current image.",
      "The posterior pole remains well visualised, supporting a usable non-referable screen.",
      "Routine monitoring remains appropriate unless symptoms or examination findings indicate otherwise."
    ],
    clinicalExplanation:
      "The current image does not show a referral-level lesion pattern. This result should be interpreted as a non-referable screening outcome rather than a definitive exclusion of all retinal disease.",
    qualitySummary: "Posterior pole is visible with mild peripheral shadowing that does not limit review.",
    captureDevice: "Topcon NW400 fundus camera",
    lesionConfig: {}
  }),
  createCaseRecord({
    id: "VIS-260330-009",
    patientReference: "PT-9170",
    capturedAt: "2026-03-30T10:42:00.000Z",
    receivedAt: "2026-03-30T10:40:00.000Z",
    processedAt: "2026-03-30T10:42:15.000Z",
    grade: 4,
    confidence: "high",
    laterality: "OD",
    accent: "#d47950",
    discX: 642,
    vesselColor: "#9d3117",
    findings: [
      "Neovascular signal is highlighted close to the optic disc with additional haemorrhagic burden.",
      "The lesion pattern is consistent with proliferative disease and should not wait for routine review.",
      "Emergency retina referral is recommended based on the current image evidence."
    ],
    clinicalExplanation:
      "The presence of neovascularisation signal together with widespread haemorrhages suggests proliferative diabetic retinopathy. This is displayed as an emergency referral recommendation because the image indicates a sight-threatening pattern that requires rapid specialist review.",
    qualitySummary: "Image quality is high and the optic disc region is clearly visible for review.",
    notes: "Patient reported recent floaters during screening intake.",
    captureDevice: "Canon CR-2 AF",
    lesionConfig: {
      haemorrhages: {
        present: true,
        confidence: "high",
        summary: "Widespread haemorrhagic burden is highlighted across the posterior pole."
      },
      irma: {
        present: true,
        confidence: "moderate",
        summary: "Advanced vascular abnormality signal is present near the superior arcade."
      },
      neovascularisation: {
        present: true,
        confidence: "high",
        summary: "Neovascular signal is concentrated near the disc and adjacent vessel arcs."
      }
    }
  }),
  createCaseRecord({
    id: "VIS-260329-021",
    patientReference: "PT-9148",
    capturedAt: "2026-03-29T14:05:00.000Z",
    receivedAt: "2026-03-29T14:03:00.000Z",
    processedAt: "2026-03-29T14:05:10.000Z",
    grade: 1,
    confidence: "high",
    laterality: "OS",
    accent: "#c56c44",
    discX: 618,
    vesselColor: "#8b371d",
    findings: [
      "Low-volume microaneurysm signal is present without stronger referable features.",
      "No urgent lesion pattern is highlighted in the current image.",
      "Routine monitoring remains appropriate for the displayed category."
    ],
    clinicalExplanation:
      "This screening result sits within the non-referable display category used in the clinical UI. Mild lesion signal may be present, but the overall pattern does not rise to the referral threshold in this mock case.",
    qualitySummary: "Usable image with mild peripheral vignetting and preserved central detail.",
    captureDevice: "Topcon NW400 fundus camera",
    lesionConfig: {
      ma: {
        present: true,
        confidence: "moderate",
        summary: "Sparse microaneurysm signal is highlighted without broader lesion burden."
      }
    }
  }),
  createCaseRecord({
    id: "VIS-260328-018",
    patientReference: "PT-9139",
    capturedAt: "2026-03-28T16:28:00.000Z",
    receivedAt: "2026-03-28T16:26:00.000Z",
    processedAt: "2026-03-28T16:28:14.000Z",
    grade: 2,
    confidence: "moderate",
    laterality: "OU",
    accent: "#c86f46",
    discX: 626,
    vesselColor: "#8e351b",
    findings: [
      "Hard exudate and microaneurysm signal are present in a moderate pattern.",
      "Image quality remains clinically usable, though there is mild blur outside the central field.",
      "Referral is recommended because the highlighted lesions exceed the non-referable threshold."
    ],
    clinicalExplanation:
      "The result suggests moderate diabetic retinopathy with an interpretable but slightly softer image. A referral remains appropriate because the lesion pattern is still visible and crosses the display threshold for specialist review.",
    qualitySummary: "Moderate image quality with minor blur at the temporal edge.",
    notes: "Both eyes captured during the same session. This mock result represents the more concerning eye.",
    captureDevice: "Nidek AFC-330",
    lesionConfig: {
      ma: {
        present: true,
        confidence: "moderate",
        summary: "Microaneurysm signal remains visible despite mild edge blur."
      },
      hard_exudates: {
        present: true,
        confidence: "moderate",
        summary: "Hard exudate clusters are highlighted near the superior arcade."
      }
    }
  }),
  createCaseRecord({
    id: "VIS-260327-011",
    patientReference: "PT-9096",
    capturedAt: "2026-03-27T13:18:00.000Z",
    receivedAt: "2026-03-27T13:16:00.000Z",
    processedAt: "2026-03-27T13:18:08.000Z",
    grade: 3,
    confidence: "moderate",
    laterality: "OS",
    accent: "#cb7447",
    discX: 616,
    vesselColor: "#90351a",
    findings: [
      "Haemorrhagic and IRMA signals indicate more advanced disease burden.",
      "The image remains interpretable, but moderate blur reduces confidence compared with a cleaner capture.",
      "Urgent specialist review remains the appropriate next step."
    ],
    clinicalExplanation:
      "The pattern suggests severe diabetic retinopathy, even though the image is slightly softer than ideal. Confidence is moderate rather than high because the retinal detail is still usable but not optimally crisp.",
    qualitySummary: "Moderate quality with slight blur but sufficient central retinal visibility.",
    captureDevice: "Canon CR-2 AF",
    lesionConfig: {
      haemorrhages: {
        present: true,
        confidence: "high",
        summary: "Haemorrhages remain convincingly highlighted across the central field."
      },
      irma: {
        present: true,
        confidence: "moderate",
        summary: "IRMA signal is present but partially limited by image softness."
      }
    }
  }),
  createCaseRecord({
    id: "VIS-260326-007",
    patientReference: "PT-9074",
    capturedAt: "2026-03-26T09:48:00.000Z",
    receivedAt: "2026-03-26T09:46:00.000Z",
    processedAt: "2026-03-26T09:48:12.000Z",
    grade: 0,
    confidence: "high",
    laterality: "OD",
    accent: "#bb673d",
    discX: 608,
    vesselColor: "#81351c",
    findings: [
      "No convincing referral-level lesion burden is highlighted in this screening image.",
      "Image quality is clean and supports a high-confidence non-referable result.",
      "Routine monitoring is appropriate unless there are additional clinical concerns."
    ],
    clinicalExplanation:
      "This mock case represents a clean non-referable result with high image quality and no highlighted proliferative or moderate lesion burden. The result should still be interpreted in the context of the clinical examination.",
    qualitySummary: "High image quality with strong central contrast and clear vessel detail.",
    captureDevice: "Topcon NW400 fundus camera",
    lesionConfig: {}
  })
].sort((left, right) => new Date(right.capturedAt).getTime() - new Date(left.capturedAt).getTime());

export const recentCases = allCases.slice(0, 5);

export const caseHistoryDemo: CaseSummary[] = allCases.map((caseRecord) => ({
  id: caseRecord.id,
  capturedAt: caseRecord.capturedAt,
  grade: caseRecord.grade,
  thumbnailSrc: caseRecord.thumbnailSrc,
  patientReference: caseRecord.patientReference,
  laterality: caseRecord.laterality,
  confidence: caseRecord.confidence
}));

export function getCaseById(caseId: string) {
  return allCases.find((caseRecord) => caseRecord.id === caseId);
}

const uiToApiEyeSide: Record<EyeSide, ApiEyeSide> = {
  OS: "left",
  OD: "right",
  OU: "both"
};

function buildConfidenceExplanation(tier: ConfidenceTier) {
  return CONFIDENCE_CONFIG[tier].description;
}

function buildGradeProbabilities(grade: 0 | 1 | 2 | 3 | 4): [number, number, number, number, number] {
  const profiles: Record<0 | 1 | 2 | 3 | 4, [number, number, number, number, number]> = {
    0: [0.82, 0.12, 0.04, 0.01, 0.01],
    1: [0.08, 0.77, 0.11, 0.03, 0.01],
    2: [0.05, 0.18, 0.56, 0.16, 0.05],
    3: [0.01, 0.04, 0.09, 0.72, 0.14],
    4: [0.01, 0.02, 0.05, 0.16, 0.76]
  };

  return profiles[grade];
}

function buildApiInferenceResult(caseRecord: CaseRecord): InferenceResult {
  const lesionPresence = Object.fromEntries(
    caseRecord.lesionFindings.map((finding) => [uiToApiLesionChannel[finding.id], finding.present])
  ) as Record<ApiLesionChannelId, boolean>;

  const lesionConfidence = Object.fromEntries(
    caseRecord.lesionFindings.map((finding) => [
      uiToApiLesionChannel[finding.id],
      finding.confidence === "high" ? 0.91 : finding.confidence === "moderate" ? 0.74 : 0.33
    ])
  ) as Record<ApiLesionChannelId, number>;

  const overlayUrls = Object.fromEntries(
    caseRecord.lesionFindings.map((finding) => [uiToApiLesionChannel[finding.id], `/api/v1/cases/${caseRecord.id}/overlays/${uiToApiLesionChannel[finding.id]}`])
  ) as Record<ApiLesionChannelId, string>;

  const gradeLabelMap = {
    0: "No DR",
    1: "Mild NPDR",
    2: "Moderate NPDR",
    3: "Severe NPDR",
    4: "PDR"
  } as const;

  const referralUrgencyMap = {
    0: "none",
    1: "none",
    2: "routine",
    3: "urgent",
    4: "emergency"
  } as const;

  const referralLabelMap = {
    0: "No specialist referral required at this time",
    1: "No specialist referral required at this time",
    2: "Ophthalmologist referral recommended",
    3: "Urgent ophthalmologist referral recommended",
    4: "Emergency retina referral recommended"
  } as const;

  return {
    grade: caseRecord.grade,
    grade_label: gradeLabelMap[caseRecord.grade],
    referral_required: caseRecord.grade >= 2,
    referral_urgency: referralUrgencyMap[caseRecord.grade],
    referral_label: referralLabelMap[caseRecord.grade],
    confidence_tier: caseRecord.confidence,
    confidence_score: caseRecord.confidence === "high" ? 0.91 : caseRecord.confidence === "moderate" ? 0.76 : 0.43,
    confidence_explanation: buildConfidenceExplanation(caseRecord.confidence),
    clinical_summary: caseRecord.clinicalExplanation,
    grade_probabilities: buildGradeProbabilities(caseRecord.grade),
    lesion_presence: lesionPresence,
    lesion_confidence: lesionConfidence,
    overlay_urls: overlayUrls,
    model_version: caseRecord.modelVersion,
    inference_time_ms: 10840,
    processed_at: caseRecord.processedAt
  };
}

export const mockCaseResponses: CaseResponse[] = allCases.slice(0, 5).map((caseRecord) => ({
  case_id: caseRecord.id,
  patient_ref: caseRecord.patientReference,
  eye_side: uiToApiEyeSide[caseRecord.laterality],
  notes: caseRecord.notes ?? null,
  status: "complete",
  created_at: caseRecord.receivedAt,
  image_url: `/api/v1/cases/${caseRecord.id}/image`,
  result: buildApiInferenceResult(caseRecord)
}));

export const uploadDraftDefaults = {
  patientReference: "PT-9234",
  analysisTargetCaseId: "VIS-260331-008"
};

export const modelPerformanceMetrics: ModelMetric[] = [
  {
    label: "Referable DR sensitivity",
    value: "94.2%",
    description:
      "In plain language, the model usually flags images that merit specialist review rather than missing them."
  },
  {
    label: "Referable DR specificity",
    value: "90.1%",
    description:
      "Most non-referable screening images stay in the routine-monitoring category instead of being over-referred."
  },
  {
    label: "Calibration quality",
    value: "ECE 0.047",
    description:
      "Confidence tiers are tuned so high-confidence outputs are more aligned with actual model reliability."
  },
  {
    label: "Median analysis time",
    value: "11.4 s",
    description: "The frontend is designed around a calm 10 to 15 second review workflow."
  }
];

export const validationDatasetFacts: ValidationFact[] = [
  {
    label: "Validation images",
    value: "18,420",
    description: "Representative colour fundus photographs spanning non-referable through proliferative disease."
  },
  {
    label: "Partner settings",
    value: "3 sites",
    description: "Images reflect both screening and specialist referral contexts."
  },
  {
    label: "Reference standard",
    value: "5-grade adjudication",
    description: "Retinal specialists adjudicated severity labels for clinical framing."
  },
  {
    label: "Output scope",
    value: "Grade + referral + lesions",
    description: "The model produces referral guidance, lesion segmentation, and calibrated confidence tiers."
  }
];

export const modelLimitations = [...MODEL_LIMITATIONS];

export const researchTeam = [
  "Shubham Mishra, BITS Pilani - ML and backend lead",
  "Saumya Agarwal, BITS Pilani - co-developer",
  "Supervision: Prof. Raj Kumar Gupta and Prof. Pabitra Biswas"
] as const;

export const notificationSettings: SettingToggle[] = [
  {
    id: "new-referral",
    label: "Urgent referral alerts",
    description: "Notify when a newly processed case falls into urgent or emergency referral categories.",
    enabled: true
  },
  {
    id: "report-ready",
    label: "Report ready notifications",
    description: "Notify when a PDF-ready report has been prepared for review or export.",
    enabled: true
  },
  {
    id: "weekly-summary",
    label: "Weekly screening summary",
    description: "Send a compact overview of case volume, referral rate, and operational uptime.",
    enabled: false
  }
];

export const exportSettings: SettingToggle[] = [
  {
    id: "include-overlays",
    label: "Include lesion overlays",
    description: "Attach channel-level overlay figures to every exported report when lesions are present.",
    enabled: true
  },
  {
    id: "include-notes",
    label: "Include clinical notes",
    description: "Add technician-entered notes to the report footer when notes were recorded.",
    enabled: true
  },
  {
    id: "include-validation-context",
    label: "Include validation context",
    description: "Append a short validation summary and model version reference to the report.",
    enabled: true
  }
];

export const confidenceDescriptions = Object.fromEntries(
  Object.entries(CONFIDENCE_CONFIG).map(([key, value]) => [key, value.description])
) as Record<ConfidenceTier, string>;
