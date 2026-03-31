"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Download, FileText, Info } from "lucide-react";
import { useQueries } from "@tanstack/react-query";
import { GradeBadge } from "@/components/clinical/grade-badge";
import { LesionOverlayViewer } from "@/components/clinical/lesion-overlay-viewer";
import { ReferralCard } from "@/components/clinical/referral-card";
import { AppShellLoading } from "@/components/layout/app-shell-loading";
import { EmptyState } from "@/components/layout/empty-state";
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
import { buildCaseFallbackImage, buildLesionFindings, buildReferralReasons } from "@/lib/case-mappers";
import { CLINICAL_DISCLAIMER } from "@/lib/constants";
import type { ApiLesionChannelId } from "@/lib/types";
import { downloadBlob, formatDateTime } from "@/lib/utils";

const eyeSideLabels = {
  left: "Left Eye",
  right: "Right Eye",
  both: "Both Eyes"
} as const;

const progressSteps = [
  { estimatedSecondsRemaining: 12, progress: 18, step: "preprocessing" as const },
  { estimatedSecondsRemaining: 9, progress: 46, step: "analysis" as const },
  { estimatedSecondsRemaining: 5, progress: 74, step: "overlays" as const },
  { estimatedSecondsRemaining: 2, progress: 92, step: "results" as const }
];

export function CaseResultsPageClient({ caseId }: { caseId: string }) {
  const { hydrated, token } = useAuthSession();
  const caseQuery = useCase(caseId, token);
  const reportMutation = useDownloadReport();
  const [progressIndex, setProgressIndex] = useState(0);

  useEffect(() => {
    if (caseQuery.data?.status !== "processing") {
      return;
    }

    const interval = window.setInterval(() => {
      setProgressIndex((current) => (current + 1) % progressSteps.length);
    }, 1400);

    return () => window.clearInterval(interval);
  }, [caseQuery.data?.status]);

  const imageQuery = useAssetUrl(caseQuery.data?.image_url, token);
  const baseLesionFindings = caseQuery.data?.result ? buildLesionFindings(caseQuery.data) : [];
  const rawOverlayQueries = useQueries({
    queries:
      caseQuery.data?.result && token
        ? baseLesionFindings.map((finding) => ({
            enabled: Boolean(caseQuery.data?.result?.overlay_urls[finding.apiChannel]),
            queryFn: async () => {
              const assetBlob = await api.fetchAsset(caseQuery.data?.result?.overlay_urls[finding.apiChannel] ?? "", token);
              return URL.createObjectURL(assetBlob);
            },
            queryKey: ["overlay", caseId, finding.apiChannel, token],
            staleTime: 60_000
          }))
        : []
  });
  const overlayQueries = Object.fromEntries(
    baseLesionFindings.map((finding, index) => [finding.apiChannel, rawOverlayQueries[index]])
  ) as Partial<Record<ApiLesionChannelId, (typeof rawOverlayQueries)[number]>>;

  if (!hydrated) {
    return <AppShellLoading />;
  }

  if (!token) {
    return (
      <EmptyState
        actionHref="/login"
        actionLabel="Return to login"
        description="Sign in to review live case results and download PDF reports."
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
          description="The requested case could not be found for the current signed-in user."
          title="Case not found"
        />
      );
    }

    return (
      <RouteErrorState
        description="The live case result could not be loaded. Please retry the request or return to history."
        reset={() => {
          void caseQuery.refetch();
        }}
        title="Unable to load case results"
      />
    );
  }

  const caseResponse = caseQuery.data;
  if (!caseResponse) {
    return <AppShellLoading />;
  }

  if (caseResponse.status === "processing" || caseResponse.result === null) {
    const progressState = progressSteps[progressIndex];

    return (
      <div className="space-y-6">
        <InferenceProgressCard
          currentStep={progressState.step}
          estimatedSecondsRemaining={progressState.estimatedSecondsRemaining}
          progress={progressState.progress}
        />
        <Card className="glass-panel border border-white/50">
          <CardContent className="space-y-3 p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">Case in progress</p>
            <p className="text-lg font-semibold text-slate-950">{caseResponse.case_id}</p>
            <p className="text-sm leading-7 text-slate-600">
              Referral, grade, confidence, and overlays will appear here automatically as the frontend continues polling the case endpoint.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const lesionFindings = buildLesionFindings(caseResponse).map((finding) => ({
    ...finding,
    overlaySrc: overlayQueries[finding.apiChannel]?.data ?? finding.overlaySrc
  }));
  const originalImageSrc = imageQuery.data ?? buildCaseFallbackImage(caseResponse.case_id, caseResponse.result.grade);
  const referralReasons = buildReferralReasons(caseResponse);

  async function handleDownloadReport() {
    try {
      const pdfBlob = await reportMutation.mutateAsync({ caseId, token: sessionToken });
      downloadBlob(pdfBlob, `${caseId}-report.pdf`);
    } catch {}
  }

  return (
    <div className="space-y-8">
      <ReferralCard
        confidence={caseResponse.result.confidence_tier}
        findings={referralReasons}
        grade={caseResponse.result.grade}
        patientReference={caseResponse.patient_ref}
      />

      <Card className="glass-panel border border-white/50">
        <CardContent className="flex flex-col gap-4 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">DR category</p>
            <div className="flex flex-wrap items-center gap-3">
              <GradeBadge grade={caseResponse.result.grade} showCode />
              <h2 className="text-2xl font-semibold text-slate-950">{caseResponse.result.grade_label}</h2>
            </div>
          </div>
          <div className="rounded-[24px] border border-slate-200 bg-white/80 px-5 py-4 text-sm text-slate-600">
            Referral status: <span className="font-semibold text-slate-950">{caseResponse.result.referral_label}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel border border-white/50">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <ConfidenceBadge tier={caseResponse.result.confidence_tier} />
            <p className="text-lg font-semibold text-slate-950">Confidence explanation</p>
          </div>
          <p className="max-w-4xl text-sm leading-7 text-slate-600">{caseResponse.result.confidence_explanation}</p>
        </CardContent>
      </Card>

      <LesionOverlayViewer
        defaultVisible={lesionFindings.filter((finding) => finding.present).slice(0, 3).map((finding) => finding.id)}
        imageSrc={originalImageSrc}
        overlays={lesionFindings}
      />

      <Card className="glass-panel border border-white/50">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Per-lesion findings</p>
            <h2 className="text-2xl font-semibold text-slate-950">Channel-level presence review</h2>
          </div>
          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white/80">
            <table className="min-w-full text-left">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                <tr>
                  <th className="px-5 py-4">Lesion channel</th>
                  <th className="px-5 py-4">Detected</th>
                  <th className="px-5 py-4">Confidence</th>
                  <th className="px-5 py-4">Clinical note</th>
                </tr>
              </thead>
              <tbody>
                {lesionFindings.map((finding) => (
                  <tr className="border-b border-slate-200/80 align-top text-sm text-slate-700 last:border-b-0" key={finding.id}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="h-4 w-4 rounded-full border border-white/80 shadow-sm" style={{ backgroundColor: finding.swatch }} />
                        <div>
                          <p className="font-semibold text-slate-950">{finding.label}</p>
                          <p className="text-xs uppercase tracking-wide text-slate-500">{finding.shortLabel}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          finding.present ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {finding.present ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-5 py-4 capitalize">{finding.confidence}</td>
                    <td className="px-5 py-4 leading-7 text-slate-600">{finding.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel border border-white/50">
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center gap-2 text-slate-950">
            <Info className="h-4 w-4 text-primary" />
            <p className="text-lg font-semibold">Plain-language explanation</p>
          </div>
          <p className="max-w-5xl text-sm leading-8 text-slate-600">{caseResponse.result.clinical_summary}</p>
        </CardContent>
      </Card>

      <Card className="glass-panel border border-white/50">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Export</p>
            <p className="mt-2 text-sm leading-7 text-slate-600">Download the latest report PDF with the original fundus image, findings summary, overlays, and disclaimer language.</p>
          </div>
          <Button className="h-12 px-6 text-base" disabled={reportMutation.isPending} onClick={() => void handleDownloadReport()} size="lg" type="button">
            <Download className="mr-2 h-4 w-4" />
            {reportMutation.isPending ? "Preparing report..." : "Download Report"}
          </Button>
        </CardContent>
      </Card>

      <Card className="glass-panel border border-white/50">
        <CardContent className="grid gap-6 p-6 xl:grid-cols-[0.8fr,1.2fr]">
          <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950">
            <div className="relative aspect-square">
              <Image
                alt={`${caseResponse.case_id} original fundus`}
                className="object-cover"
                fill
                sizes="(min-width: 1280px) 35vw, 100vw"
                src={originalImageSrc}
                unoptimized
              />
            </div>
          </div>
          <div className="space-y-5">
            <div className="flex items-center gap-2 text-slate-950">
              <FileText className="h-4 w-4 text-primary" />
              <h2 className="text-2xl font-semibold">Case metadata</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
                <p className="text-sm text-slate-500">Case ID</p>
                <p className="mt-1 text-base font-semibold text-slate-950">{caseResponse.case_id}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
                <p className="text-sm text-slate-500">Patient reference</p>
                <p className="mt-1 text-base font-semibold text-slate-950">{caseResponse.patient_ref}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
                <p className="text-sm text-slate-500">Eye side</p>
                <p className="mt-1 text-base font-semibold text-slate-950">{eyeSideLabels[caseResponse.eye_side]}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
                <p className="text-sm text-slate-500">Case created</p>
                <p className="mt-1 text-base font-semibold text-slate-950">{formatDateTime(caseResponse.created_at)}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
                <p className="text-sm text-slate-500">Processed timestamp</p>
                <p className="mt-1 text-base font-semibold text-slate-950">{formatDateTime(caseResponse.result.processed_at)}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4">
                <p className="text-sm text-slate-500">Model version</p>
                <p className="mt-1 text-base font-semibold text-slate-950">{caseResponse.result.model_version}</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4 md:col-span-2">
                <p className="text-sm text-slate-500">Inference duration</p>
                <p className="mt-1 text-base font-semibold text-slate-950">{(caseResponse.result.inference_time_ms / 1000).toFixed(2)} seconds</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel border border-white/50">
        <CardContent className="p-6">
          <p className="text-sm leading-8 text-slate-600">{CLINICAL_DISCLAIMER}</p>
        </CardContent>
      </Card>
    </div>
  );
}
