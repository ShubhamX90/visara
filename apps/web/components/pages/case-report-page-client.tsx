"use client";

import Image from "next/image";
import { useQueries } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { GradeBadge } from "@/components/clinical/grade-badge";
import { AppShellLoading } from "@/components/layout/app-shell-loading";
import { EmptyState } from "@/components/layout/empty-state";
import { Logo } from "@/components/layout/logo";
import { RouteErrorState } from "@/components/layout/route-error-state";
import { ConfidenceBadge } from "@/components/results/confidence-badge";
import { InferenceProgressCard } from "@/components/results/inference-progress-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useAssetUrl } from "@/hooks/use-asset-url";
import { useCase } from "@/hooks/use-case";
import { useDownloadReport } from "@/hooks/use-report";
import { api } from "@/lib/api";
import { buildCaseFallbackImage, buildLesionFindings } from "@/lib/case-mappers";
import { CLINICAL_DISCLAIMER } from "@/lib/constants";
import { validationDatasetFacts } from "@/lib/mock-data";
import { downloadBlob, formatDate, formatDateTime } from "@/lib/utils";

const progressSteps = [
  { estimatedSecondsRemaining: 12, progress: 18, step: "preprocessing" as const },
  { estimatedSecondsRemaining: 9, progress: 46, step: "analysis" as const },
  { estimatedSecondsRemaining: 5, progress: 74, step: "overlays" as const },
  { estimatedSecondsRemaining: 2, progress: 92, step: "results" as const }
];

const eyeSideLabels = {
  left: "Left Eye",
  right: "Right Eye",
  both: "Both Eyes"
} as const;

export function CaseReportPageClient({ caseId }: { caseId: string }) {
  const { hydrated, token } = useAuthSession();
  const caseQuery = useCase(caseId, token);
  const reportMutation = useDownloadReport();
  const originalImageQuery = useAssetUrl(caseQuery.data?.image_url, token);
  const detectedFindings =
    caseQuery.data?.status === "complete" && caseQuery.data.result
      ? buildLesionFindings(caseQuery.data).filter((finding) => finding.present)
      : [];
  const overlayQueries = useQueries({
    queries:
      token && caseQuery.data?.status === "complete" && caseQuery.data.result
        ? detectedFindings.map((finding) => ({
            enabled: Boolean(finding.overlaySrc),
            queryFn: async () => {
              const assetBlob = await api.fetchAsset(finding.overlaySrc ?? "", token);
              return URL.createObjectURL(assetBlob);
            },
            queryKey: ["report-overlay", caseId, finding.id, token],
            staleTime: 60_000
          }))
        : []
  });

  if (!hydrated) {
    return <AppShellLoading />;
  }

  if (!token) {
    return (
      <EmptyState
        actionHref="/login"
        actionLabel="Return to login"
        description="Sign in to review the live case report and download the PDF export."
        title="Authentication required"
      />
    );
  }

  const sessionToken = token;
  if (caseQuery.isLoading) {
    return <AppShellLoading />;
  }

  if (caseQuery.isError) {
    if (caseQuery.error.code === "CASE_NOT_FOUND") {
      return (
        <EmptyState
          actionHref="/history"
          actionLabel="Return to history"
          description="The requested case report could not be found for the current signed-in user."
          title="Case not found"
        />
      );
    }

    return (
      <RouteErrorState
        description="The live report preview could not be loaded. Please retry the request or return to history."
        reset={() => {
          void caseQuery.refetch();
        }}
        title="Unable to load report preview"
      />
    );
  }

  const caseResponse = caseQuery.data;
  if (!caseResponse) {
    return <AppShellLoading />;
  }

  if (caseResponse.status === "processing" || caseResponse.result === null) {
    const progressState = progressSteps[1];

    return (
      <div className="space-y-6">
        <InferenceProgressCard
          currentStep={progressState.step}
          estimatedSecondsRemaining={progressState.estimatedSecondsRemaining}
          progress={progressState.progress}
        />
        <Card className="glass-panel border border-white/50">
          <CardContent className="space-y-3 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Report pending</p>
            <p className="text-lg font-semibold text-slate-950">{caseResponse.case_id}</p>
            <p className="text-sm leading-7 text-slate-600">
              The report preview will populate automatically once inference, overlays, and the PDF payload are ready.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const enrichedFindings = detectedFindings.map((finding, index) => ({
    ...finding,
    overlaySrc: overlayQueries[index]?.data ?? finding.overlaySrc
  }));
  const originalImageSrc = originalImageQuery.data ?? buildCaseFallbackImage(caseResponse.case_id, caseResponse.result.grade);

  async function handleDownloadReport() {
    try {
      const pdfBlob = await reportMutation.mutateAsync({ caseId, token: sessionToken });
      downloadBlob(pdfBlob, `${caseId}-report.pdf`);
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button className="h-12 px-6 text-base" disabled={reportMutation.isPending} onClick={() => void handleDownloadReport()} size="lg" type="button">
          <Download className="mr-2 h-4 w-4" />
          {reportMutation.isPending ? "Preparing PDF..." : "Download PDF"}
        </Button>
      </div>

      <Card className="overflow-hidden border border-slate-200 bg-white text-slate-950 shadow-panel">
        <CardContent className="space-y-8 p-8 md:p-10">
          <div className="flex flex-col gap-5 border-b border-slate-200 pb-8 md:flex-row md:items-start md:justify-between">
            <div className="space-y-4">
              <Logo />
              <div className="space-y-1">
                <h2 className="text-3xl font-semibold tracking-tight">Case report</h2>
                <p className="text-sm text-slate-600">Clinical decision-support report preview generated from the live Visara inference service.</p>
              </div>
            </div>
            <div className="grid gap-3 text-sm md:text-right">
              <div>
                <p className="text-slate-500">Case ID</p>
                <p className="font-semibold">{caseResponse.case_id}</p>
              </div>
              <div>
                <p className="text-slate-500">Date</p>
                <p className="font-semibold">{formatDate(caseResponse.created_at)}</p>
              </div>
              <div>
                <p className="text-slate-500">Timestamp</p>
                <p className="font-semibold">{formatDateTime(caseResponse.result.processed_at)}</p>
              </div>
            </div>
          </div>

          <section className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
            <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950">
              <div className="relative aspect-square">
                <Image
                  alt={`${caseResponse.case_id} fundus report image`}
                  className="object-cover"
                  fill
                  sizes="(min-width: 1280px) 35vw, 100vw"
                  src={originalImageSrc}
                  unoptimized
                />
              </div>
            </div>
            <div className="space-y-4">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm text-slate-500">Patient reference</p>
                <p className="mt-1 text-xl font-semibold">{caseResponse.patient_ref}</p>
                <p className="mt-2 text-sm text-slate-600">{eyeSideLabels[caseResponse.eye_side]}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-medium text-slate-500">Findings summary</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <GradeBadge grade={caseResponse.result.grade} />
                  <ConfidenceBadge tier={caseResponse.result.confidence_tier} />
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-700">{caseResponse.result.referral_label}</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">{caseResponse.result.confidence_explanation}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <p className="text-sm font-medium text-slate-500">Clinical notes</p>
                <p className="mt-3 text-sm leading-7 text-slate-700">
                  {caseResponse.notes ?? "No additional clinical notes were entered for this case."}
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="text-2xl font-semibold">Lesion overlays</h3>
              <p className="mt-1 text-sm text-slate-600">One figure is shown for each detected lesion channel highlighted during the live review.</p>
            </div>
            {enrichedFindings.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {enrichedFindings.map((finding) => (
                  <div className="rounded-[24px] border border-slate-200 p-4" key={finding.id}>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="h-4 w-4 rounded-full" style={{ backgroundColor: finding.swatch }} />
                        <p className="font-semibold">{finding.label}</p>
                      </div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{finding.confidence} confidence</p>
                    </div>
                    <div className="relative overflow-hidden rounded-[20px] border border-slate-200 bg-slate-950">
                      <div className="relative aspect-square w-full">
                        <Image
                          alt={`${finding.label} underlay`}
                          className="object-cover"
                          fill
                          sizes="(min-width: 1024px) 33vw, 100vw"
                          src={originalImageSrc}
                          unoptimized
                        />
                        {finding.overlaySrc ? (
                          <Image
                            alt={`${finding.label} overlay`}
                            className="object-cover mix-blend-screen"
                            fill
                            sizes="(min-width: 1024px) 33vw, 100vw"
                            src={finding.overlaySrc}
                            unoptimized
                          />
                        ) : null}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-700">{finding.summary}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-700">
                No lesion channel crossed the current presence threshold for this case. Review the original image and overall referral summary in context.
              </div>
            )}
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-medium text-slate-500">Plain-language clinical summary</p>
            <p className="mt-3 text-sm leading-7 text-slate-700">{caseResponse.result.clinical_summary}</p>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-500">Model version</p>
              <p className="mt-2 text-base font-semibold">{caseResponse.result.model_version}</p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-medium text-slate-500">Validation context</p>
              <p className="mt-2 text-sm leading-7 text-slate-700">
                {validationDatasetFacts[0].value} validation images across {validationDatasetFacts[1].value.toLowerCase()} with specialist-adjudicated severity framing.
              </p>
            </div>
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm leading-8 text-slate-700">{CLINICAL_DISCLAIMER}</p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
