"use client";

import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import { EmptyState } from "@/components/layout/empty-state";
import { AppShellLoading } from "@/components/layout/app-shell-loading";
import { RouteErrorState } from "@/components/layout/route-error-state";
import { CaseCard } from "@/components/results/case-card";
import { ModelStatusCard } from "@/components/shared/model-status-card";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCurrentUser } from "@/hooks/use-auth";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useCases } from "@/hooks/use-case";
import { useHealthStatus } from "@/hooks/use-inference";
import { buildCaseSummary, buildDashboardStats } from "@/lib/case-mappers";
import { modelStatus } from "@/lib/mock-data";
import type { ModelStatus } from "@/lib/types";

export function DashboardPageClient() {
  const { hydrated, token } = useAuthSession();
  const userQuery = useCurrentUser(token);
  const casesQuery = useCases("?page=1&limit=100", token);
  const healthQuery = useHealthStatus();

  if (!hydrated) {
    return <AppShellLoading />;
  }

  if (!token) {
    return (
      <EmptyState
        actionHref="/login"
        actionLabel="Return to login"
        description="Sign in with your institutional account to view dashboard metrics and recent screening cases."
        title="Authentication required"
      />
    );
  }

  if (userQuery.isLoading || casesQuery.isLoading) {
    return <AppShellLoading />;
  }

  if (userQuery.isError || casesQuery.isError) {
    return (
      <RouteErrorState
        description="The dashboard could not load live case data or user context. Please retry the workspace."
        reset={() => {
          void userQuery.refetch();
          void casesQuery.refetch();
        }}
        title="Unable to load the dashboard"
      />
    );
  }

  const caseResponses = casesQuery.data?.items ?? [];
  const recentCases = caseResponses.filter((caseResponse) => caseResponse.result !== null).slice(0, 5).map(buildCaseSummary);
  const dashboardStats = buildDashboardStats(caseResponses);
  const liveModelStatus: ModelStatus = healthQuery.data
    ? {
        version: healthQuery.data.model_version,
        lastUpdated: healthQuery.data.timestamp,
        operationalStatus: healthQuery.data.status === "operational" ? "operational" : "monitoring",
        summary: healthQuery.data.model_loaded
          ? "Checkpoint-backed inference is loaded and available for live case analysis."
          : "The inference loader has not completed yet. New uploads may remain queued."
      }
    : modelStatus;

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <Card className="glass-panel overflow-hidden border border-white/50">
          <CardContent className="relative p-8">
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-sky-500/15 to-transparent" />
            <div className="relative space-y-5">
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-sky-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
                <Clock3 className="h-3.5 w-3.5" />
                Today&apos;s screening summary
              </div>
              <div className="space-y-3">
                <h2 className="text-4xl font-semibold tracking-tight text-slate-950">Welcome back, {userQuery.data?.full_name}</h2>
                <p className="max-w-3xl text-base leading-8 text-slate-600">
                  The workspace is ready for new uploads, recent case review, and referral-first interpretation of processed results.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="h-12 px-6 text-base">
                  <Link href="/upload">
                    New Case
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild className="h-12 px-6 text-base" variant="outline">
                  <Link href="/history">Open history</Link>
                </Button>
                <div className="rounded-full border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-700">
                  Average turnaround {dashboardStats.averageTurnaround}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <ModelStatusCard status={liveModelStatus} />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <StatCard
          helper="Processed since the start of the current clinical day."
          label="Cases today"
          value={`${dashboardStats.casesToday}`}
        />
        <StatCard
          helper="Total screening workload reviewed in the current week."
          label="Cases this week"
          tone="emerald"
          value={`${dashboardStats.casesThisWeek}`}
        />
        <StatCard
          helper="Share of recent cases that entered a referral pathway."
          label="Referral rate"
          tone="amber"
          value={dashboardStats.referralRate}
        />
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Recent cases</h2>
            <p className="text-sm leading-6 text-slate-300">The latest five processed cases remain one click away for review or PDF report download.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/history">View all cases</Link>
          </Button>
        </div>
        {recentCases.length === 0 ? (
          <EmptyState
            actionHref="/upload"
            actionLabel="Upload a new case"
            description="Newly processed cases will appear here once a retinal image has been submitted for analysis."
            title="No recent cases yet"
          />
        ) : (
          <div className="space-y-4">
            {recentCases.map((caseSummary) => (
              <Link className="block" href={`/cases/${caseSummary.id}` as Route} key={caseSummary.id}>
                <CaseCard caseSummary={caseSummary} />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
