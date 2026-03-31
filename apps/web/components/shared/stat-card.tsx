import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  helper: string;
  tone?: "sky" | "emerald" | "amber";
}

const toneClasses = {
  sky: "from-sky-500/20 to-cyan-400/5",
  emerald: "from-emerald-500/20 to-emerald-400/5",
  amber: "from-amber-500/20 to-orange-400/5"
} as const;

export function StatCard({ label, value, helper, tone = "sky" }: StatCardProps) {
  return (
    <Card className="glass-panel overflow-hidden border border-white/50">
      <CardContent className="relative p-6">
        <div className={cn("absolute inset-x-0 top-0 h-20 bg-gradient-to-b", toneClasses[tone])} />
        <div className="relative space-y-3">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-4xl font-semibold tracking-tight text-slate-950">{value}</p>
          <p className="text-sm leading-6 text-slate-600">{helper}</p>
        </div>
      </CardContent>
    </Card>
  );
}

