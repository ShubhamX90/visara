import { Activity, CircleAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CONFIDENCE_CONFIG } from "@/lib/constants";
import type { ConfidenceTier } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ConfidenceBadgeProps {
  tier: ConfidenceTier;
  className?: string;
}

const toneClasses = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  red: "border-rose-200 bg-rose-50 text-rose-700"
} as const;

const iconMap = {
  high: ShieldCheck,
  moderate: Activity,
  low: CircleAlert
} as const;

export function ConfidenceBadge({ tier, className }: ConfidenceBadgeProps) {
  const config = CONFIDENCE_CONFIG[tier];
  const Icon = iconMap[tier];

  return (
    <Badge className={cn("gap-2 border px-3.5 py-1.5 text-xs font-semibold", toneClasses[config.tone], className)}>
      <Icon className="h-3.5 w-3.5" />
      <span>{config.label}</span>
    </Badge>
  );
}

