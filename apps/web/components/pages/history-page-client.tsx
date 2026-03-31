"use client";

import type { Route } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";
import { GradeBadge } from "@/components/clinical/grade-badge";
import { AppShellLoading } from "@/components/layout/app-shell-loading";
import { EmptyState } from "@/components/layout/empty-state";
import { RouteErrorState } from "@/components/layout/route-error-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useCases } from "@/hooks/use-case";
import { EYE_SIDE_LABELS } from "@/lib/constants";
import type { ApiReferralUrgency, CaseResponse } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const controlClassName =
  "h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-950 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

const pageSize = 5;
const referralFilterOptions: Array<{ label: string; value: ApiReferralUrgency }> = [
  { label: "Routine monitoring", value: "none" },
  { label: "Refer", value: "routine" },
  { label: "Refer urgently", value: "urgent" },
  { label: "Emergency referral", value: "emergency" }
];

export function HistoryPageClient() {
  const { hydrated, token } = useAuthSession();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [referralFilter, setReferralFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [page, setPage] = useState(1);

  const queryString = useMemo(() => {
    const searchParams = new URLSearchParams({
      limit: "100",
      page: "1"
    });

    if (gradeFilter !== "all") {
      searchParams.set("grade_filter", gradeFilter);
    }

    if (referralFilter !== "all") {
      searchParams.set("referral_filter", referralFilter);
    }

    if (startDate) {
      searchParams.set("date_from", startDate);
    }

    if (endDate) {
      searchParams.set("date_to", endDate);
    }

    return `?${searchParams.toString()}`;
  }, [endDate, gradeFilter, referralFilter, startDate]);

  const casesQuery = useCases(queryString, token);
  const sortedCases = useMemo(() => {
    const caseItems = [...(casesQuery.data?.items ?? [])];

    caseItems.sort((left, right) => {
      if (sortOrder === "oldest") {
        return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
      }

      if (sortOrder === "highest-grade") {
        return (right.result?.grade ?? -1) - (left.result?.grade ?? -1);
      }

      return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    });

    return caseItems;
  }, [casesQuery.data?.items, sortOrder]);

  if (!hydrated) {
    return <AppShellLoading />;
  }

  if (!token) {
    return (
      <EmptyState
        actionHref="/login"
        actionLabel="Return to login"
        description="Sign in to review historic screening cases, referral decisions, and export-ready reports."
        title="Authentication required"
      />
    );
  }

  if (casesQuery.isLoading) {
    return <AppShellLoading />;
  }

  if (casesQuery.isError) {
    return (
      <RouteErrorState
        description="The historical case list could not be loaded from the live API. Please retry the request."
        reset={() => {
          void casesQuery.refetch();
        }}
        title="Unable to load case history"
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(sortedCases.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedCases = sortedCases.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  function renderGradeCell(caseResponse: CaseResponse) {
    if (caseResponse.status === "complete" && caseResponse.result) {
      return <GradeBadge grade={caseResponse.result.grade} />;
    }

    return (
      <span
        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
          caseResponse.status === "failed" ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-600"
        }`}
      >
        {caseResponse.status === "failed" ? "Analysis failed" : "Processing"}
      </span>
    );
  }

  function renderReferralCell(caseResponse: CaseResponse) {
    if (caseResponse.status !== "complete" || !caseResponse.result) {
      return <span className="text-slate-500">{caseResponse.status === "failed" ? "Retry needed" : "Pending"}</span>;
    }

    return <span className="font-medium text-slate-900">{caseResponse.result.referral_label}</span>;
  }

  return (
    <div className="space-y-6">
      <Card className="glass-panel border border-white/50">
        <CardContent className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="history-start-date">
              Start date
            </label>
            <Input
              id="history-start-date"
              onChange={(event) => {
                setStartDate(event.target.value);
                setPage(1);
              }}
              type="date"
              value={startDate}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="history-end-date">
              End date
            </label>
            <Input
              id="history-end-date"
              onChange={(event) => {
                setEndDate(event.target.value);
                setPage(1);
              }}
              type="date"
              value={endDate}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="grade-filter">
              Grade
            </label>
            <select
              className={controlClassName}
              id="grade-filter"
              onChange={(event) => {
                setGradeFilter(event.target.value);
                setPage(1);
              }}
              value={gradeFilter}
            >
              <option value="all">All grades</option>
              <option value="0">Grade 0</option>
              <option value="1">Grade 1</option>
              <option value="2">Grade 2</option>
              <option value="3">Grade 3</option>
              <option value="4">Grade 4</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="referral-filter">
              Referral status
            </label>
            <select
              className={controlClassName}
              id="referral-filter"
              onChange={(event) => {
                setReferralFilter(event.target.value);
                setPage(1);
              }}
              value={referralFilter}
            >
              <option value="all">All referral states</option>
              {referralFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="sort-order">
              Sort
            </label>
            <select
              className={controlClassName}
              id="sort-order"
              onChange={(event) => {
                setSortOrder(event.target.value);
                setPage(1);
              }}
              value={sortOrder}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="highest-grade">Highest grade first</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {paginatedCases.length === 0 ? (
        <EmptyState
          actionHref="/upload"
          actionLabel="Create a new case"
          description="Adjust the current filters or upload another screening image to populate the live case table."
          title="No cases match the selected filters"
        />
      ) : (
        <Card className="glass-panel border border-white/50">
          <CardContent className="space-y-5 p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    <th className="px-6 py-4">Case ID</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Eye</th>
                    <th className="px-6 py-4">Grade</th>
                    <th className="px-6 py-4">Referral</th>
                    <th className="px-6 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedCases.map((caseResponse) => (
                    <tr className="border-b border-slate-200/80 text-sm text-slate-700" key={caseResponse.case_id}>
                      <td className="px-6 py-5 font-semibold text-slate-950">{caseResponse.case_id}</td>
                      <td className="px-6 py-5">{formatDateTime(caseResponse.created_at)}</td>
                      <td className="px-6 py-5">
                        {caseResponse.eye_side === "left" ? EYE_SIDE_LABELS.OS : caseResponse.eye_side === "right" ? EYE_SIDE_LABELS.OD : EYE_SIDE_LABELS.OU}
                      </td>
                      <td className="px-6 py-5">{renderGradeCell(caseResponse)}</td>
                      <td className="px-6 py-5">{renderReferralCell(caseResponse)}</td>
                      <td className="px-6 py-5">
                        <div className="flex flex-wrap gap-2">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/cases/${caseResponse.case_id}` as Route}>View</Link>
                          </Button>
                          {caseResponse.status === "complete" ? (
                            <Button asChild size="sm">
                              <Link href={`/cases/${caseResponse.case_id}/report` as Route}>Report</Link>
                            </Button>
                          ) : (
                            <Button disabled size="sm">
                              Report
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, sortedCases.length)} of {sortedCases.length} cases
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button disabled={currentPage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))} size="sm" variant="outline">
                  Previous
                </Button>
                {Array.from({ length: totalPages }).map((_, index) => (
                  <Button
                    key={index}
                    onClick={() => setPage(index + 1)}
                    size="sm"
                    variant={currentPage === index + 1 ? "default" : "outline"}
                  >
                    {index + 1}
                  </Button>
                ))}
                <Button
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  size="sm"
                  variant="outline"
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
