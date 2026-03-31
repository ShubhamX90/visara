import type { Route } from "next";

export type DrGrade = 0 | 1 | 2 | 3 | 4;

export type ReferralUrgency = "non_referable" | "refer" | "urgent" | "emergency";
export type ApiReferralUrgency = "none" | "routine" | "urgent" | "emergency";

export type ConfidenceTier = "high" | "moderate" | "low";

export type EyeSide = "OD" | "OS" | "OU";
export type ApiEyeSide = "left" | "right" | "both";

export type LesionChannelId =
  | "ma"
  | "hard_exudates"
  | "haemorrhages"
  | "soft_exudates"
  | "irma"
  | "neovascularisation";
export type ApiLesionChannelId = "ma" | "he" | "hem" | "se" | "irma" | "nv";

export interface LesionOverlay {
  id: LesionChannelId;
  label: string;
  shortLabel: string;
  color: string;
  swatch: string;
  description: string;
  overlaySrc?: string;
}

export interface CaseSummary {
  id: string;
  capturedAt: string;
  grade: DrGrade;
  thumbnailSrc: string;
  patientReference: string;
  laterality: EyeSide;
  confidence: ConfidenceTier;
}

export interface LesionFinding extends LesionOverlay {
  apiChannel: ApiLesionChannelId;
  present: boolean;
  confidence: ConfidenceTier;
  summary: string;
}

export interface CaseRecord extends CaseSummary {
  originalImageSrc: string;
  receivedAt: string;
  processedAt: string;
  modelVersion: string;
  captureDevice: string;
  qualitySummary: string;
  clinicalExplanation: string;
  findings: string[];
  notes?: string;
  lesionFindings: LesionFinding[];
}

export type InferenceStepId = "preprocessing" | "analysis" | "overlays" | "results";

export interface InferenceResult {
  grade: DrGrade;
  grade_label: string;
  referral_required: boolean;
  referral_urgency: ApiReferralUrgency;
  referral_label: string;
  confidence_tier: ConfidenceTier;
  confidence_score: number;
  confidence_explanation: string;
  clinical_summary: string;
  grade_probabilities: [number, number, number, number, number];
  lesion_presence: Record<ApiLesionChannelId, boolean>;
  lesion_confidence: Record<ApiLesionChannelId, number>;
  overlay_urls: Record<ApiLesionChannelId, string>;
  model_version: string;
  inference_time_ms: number;
  processed_at: string;
}

export interface CaseResponse {
  case_id: string;
  patient_ref: string;
  eye_side: ApiEyeSide;
  notes: string | null;
  status: "processing" | "complete" | "failed";
  created_at: string;
  image_url: string;
  result: InferenceResult | null;
}

export interface CaseListResponse {
  items: CaseResponse[];
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: "bearer";
}

export interface UserResponse {
  user_id: string;
  email: string;
  full_name: string;
  role: "technician" | "doctor" | "admin";
  institution: string;
}

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  model_version: string;
  gpu_available: boolean;
  timestamp: string;
}

export interface ApiErrorResponse {
  code: string;
  message: string;
  detail: string | null;
}

export interface AppUser {
  name: string;
  email: string;
  role: string;
  initials: string;
  institution: string;
}

export interface DashboardStats {
  casesToday: number;
  casesThisWeek: number;
  referralRate: string;
  averageTurnaround: string;
}

export interface ModelStatus {
  version: string;
  lastUpdated: string;
  operationalStatus: "operational" | "monitoring";
  summary: string;
}

export interface ModelMetric {
  label: string;
  value: string;
  description: string;
}

export interface ValidationFact {
  label: string;
  value: string;
  description: string;
}

export interface SettingToggle {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
}

export interface BreadcrumbItem {
  label: string;
  href?: Route;
}
