import type { Metadata } from "next";
import { CaseResultsPageClient } from "@/components/pages/case-results-page-client";

export const metadata: Metadata = {
  title: "Case Review | Visara",
  description: "Referral-first diabetic retinopathy case review with lesion overlays and clinician-facing explanation."
};

export default function CaseResultsPage({ params }: { params: { caseId: string } }) {
  return <CaseResultsPageClient caseId={params.caseId} />;
}
