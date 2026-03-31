import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { GradeBadge } from "@/components/clinical/grade-badge";
import { ConfidenceBadge } from "@/components/results/confidence-badge";
import { Card } from "@/components/ui/card";
import { EYE_SIDE_LABELS, getGradeConfig } from "@/lib/constants";
import type { CaseSummary } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

interface CaseCardProps {
  caseSummary: CaseSummary;
  className?: string;
}

const urgencyText = {
  non_referable: "Routine monitoring",
  refer: "Refer",
  urgent: "Refer urgently",
  emergency: "Emergency referral"
} as const;

export function CaseCard({ caseSummary, className }: CaseCardProps) {
  const gradeConfig = getGradeConfig(caseSummary.grade);
  const formattedDate = formatDateTime(caseSummary.capturedAt);

  return (
    <Card
      className={cn(
        "glass-panel flex items-center gap-4 border border-white/40 p-4 transition-transform hover:-translate-y-1 hover:shadow-glow",
        className
      )}
    >
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[20px] border border-slate-200 bg-slate-950">
        <Image alt={`${caseSummary.id} thumbnail`} className="object-cover" fill sizes="96px" src={caseSummary.thumbnailSrc} unoptimized />
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-950">{caseSummary.id}</p>
            <p className="text-sm text-slate-500">
              {caseSummary.patientReference} | {EYE_SIDE_LABELS[caseSummary.laterality]} | {formattedDate}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <GradeBadge grade={caseSummary.grade} />
            <ConfidenceBadge tier={caseSummary.confidence} />
          </div>
        </div>
        <div className="flex items-center justify-between rounded-[20px] border border-slate-200 bg-white/80 px-4 py-3">
          <p className="text-sm font-medium text-slate-600">Referral status</p>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span>{urgencyText[gradeConfig.referral]}</span>
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </div>
        </div>
      </div>
    </Card>
  );
}
