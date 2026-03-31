import { AlertTriangle, ArrowRight, ShieldCheck, Siren, Stethoscope } from "lucide-react";
import { GradeBadge } from "@/components/clinical/grade-badge";
import { ConfidenceBadge } from "@/components/results/confidence-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { getGradeConfig } from "@/lib/constants";
import type { ConfidenceTier, DrGrade } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ReferralCardProps {
  grade: DrGrade;
  confidence: ConfidenceTier;
  findings: string[];
  patientReference?: string;
  className?: string;
}

const toneStyles = {
  green: {
    accent: "from-emerald-500 to-emerald-400",
    chip: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    panel: "border-emerald-100/90"
  },
  amber: {
    accent: "from-amber-500 to-amber-400",
    chip: "bg-amber-50 text-amber-700 ring-amber-200",
    panel: "border-amber-100/90"
  },
  orange: {
    accent: "from-orange-500 to-orange-400",
    chip: "bg-orange-50 text-orange-700 ring-orange-200",
    panel: "border-orange-100/90"
  },
  red: {
    accent: "from-rose-600 to-red-500",
    chip: "bg-rose-50 text-rose-700 ring-rose-200",
    panel: "border-rose-100/90"
  }
} as const;

const toneIcons = {
  green: ShieldCheck,
  amber: Stethoscope,
  orange: AlertTriangle,
  red: Siren
} as const;

export function ReferralCard({
  grade,
  confidence,
  findings,
  patientReference = "PT-9083",
  className
}: ReferralCardProps) {
  const config = getGradeConfig(grade);
  const styles = toneStyles[config.tone];
  const Icon = toneIcons[config.tone];

  return (
    <Card className={cn("glass-panel overflow-hidden border shadow-glow", styles.panel, className)}>
      <div className={cn("h-3 w-full bg-gradient-to-r", styles.accent)} />
      <CardHeader className="gap-5 bg-gradient-to-br from-white via-white to-slate-50 pb-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div
              className={cn(
                "inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold ring-1 ring-inset",
                styles.chip
              )}
            >
              <Icon className="h-4 w-4" />
              <span>Referral recommendation</span>
            </div>
            <div className="space-y-3">
              <h2 className="max-w-2xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                {config.referralTitle}
              </h2>
              <p className="max-w-2xl text-base leading-7 text-slate-600">{config.referralSummary}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <GradeBadge grade={grade} />
            <ConfidenceBadge tier={confidence} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Clinical context</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-slate-500">Patient reference</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{patientReference}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Display category</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{config.headline}</p>
            </div>
          </div>
        </div>
        <div className="rounded-[24px] border border-slate-200 bg-white/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Reason for recommendation</p>
          <ul className="mt-4 space-y-3">
            {findings.map((finding) => (
              <li key={finding} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                <ArrowRight className="mt-0.5 h-4 w-4 text-primary" />
                <span>{finding}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
