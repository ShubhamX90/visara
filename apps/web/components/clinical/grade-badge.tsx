import { Badge } from "@/components/ui/badge";
import { getGradeConfig } from "@/lib/constants";
import type { DrGrade } from "@/lib/types";
import { cn } from "@/lib/utils";

interface GradeBadgeProps {
  grade: DrGrade;
  showCode?: boolean;
  className?: string;
}

const toneClasses = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  orange: "border-orange-200 bg-orange-50 text-orange-700",
  red: "border-rose-200 bg-rose-50 text-rose-700"
} as const;

export function GradeBadge({ grade, showCode = false, className }: GradeBadgeProps) {
  const config = getGradeConfig(grade);
  const label = showCode && grade >= 2 ? `Grade ${grade} | ${config.badgeLabel}` : config.badgeLabel;

  return (
    <Badge className={cn("gap-2 border px-3.5 py-1.5 text-xs font-semibold", toneClasses[config.tone], className)}>
      <span className="h-2 w-2 rounded-full bg-current opacity-70" />
      <span>{label}</span>
    </Badge>
  );
}
