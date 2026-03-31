import type { Metadata } from "next";
import { CaseReportPageClient } from "@/components/pages/case-report-page-client";

export async function generateMetadata({
  params
}: {
  params: { caseId: string };
}): Promise<Metadata> {
  return {
    title: `Report ${params.caseId} | Visara`,
    description: "Print-ready Visara diabetic retinopathy case report for clinical export."
  };
}

export default function CaseReportPage({ params }: { params: { caseId: string } }) {
  return <CaseReportPageClient caseId={params.caseId} />;
}
