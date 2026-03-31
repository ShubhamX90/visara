import { ActivitySquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ModelStatus } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export function ModelStatusCard({ status }: { status: ModelStatus }) {
  const operational = status.operationalStatus === "operational";

  return (
    <Card className="glass-panel border border-white/50">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">Model status</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-950">{status.version}</h2>
          </div>
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
            <ActivitySquare className="h-6 w-6" />
          </div>
        </div>
        <div className="space-y-3">
          <div
            className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
              operational ? "bg-emerald-500/10 text-emerald-700" : "bg-amber-500/10 text-amber-700"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${operational ? "bg-emerald-500" : "bg-amber-500"}`} />
            {operational ? "Operational" : "Monitoring"}
          </div>
          <p className="text-sm leading-6 text-slate-600">{status.summary}</p>
        </div>
        <div className="rounded-[22px] border border-slate-200 bg-white/80 p-4 text-sm text-slate-700">
          Last updated {formatDateTime(status.lastUpdated)}
        </div>
      </CardContent>
    </Card>
  );
}
