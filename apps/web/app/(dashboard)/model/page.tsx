import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
import { CLINICAL_DISCLAIMER } from "@/lib/constants";
import { modelLimitations, modelPerformanceMetrics, researchTeam, validationDatasetFacts } from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Model | Visara",
  description: "Review Visara model framing, validation context, limitations, and research team details."
};

export default function ModelPage() {
  return (
    <div className="space-y-8">
      <Card className="glass-panel overflow-hidden border border-white/50">
        <CardContent className="space-y-5 p-8">
          <div className="inline-flex w-fit rounded-full bg-sky-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-700">
            Research and validation overview
          </div>
          <div className="space-y-3">
            <h2 className="text-4xl font-semibold tracking-tight text-slate-950">About the model and the research</h2>
            <p className="max-w-4xl text-base leading-8 text-slate-600">
              Visara presents AI-assisted diabetic retinopathy screening outputs in a clinically calm, referral-first interface. The frontend language is intentionally framed as decision support for clinicians rather than autonomous diagnosis.
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">Performance metrics in plain language</h2>
          <p className="text-sm leading-6 text-slate-300">These cards explain what the performance summary means for a clinician-facing workflow.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {modelPerformanceMetrics.map((metric) => (
            <Card className="glass-panel border border-white/50" key={metric.label}>
              <CardContent className="space-y-3 p-6">
                <p className="text-sm font-medium text-slate-500">{metric.label}</p>
                <p className="text-4xl font-semibold tracking-tight text-slate-950">{metric.value}</p>
                <p className="text-sm leading-7 text-slate-600">{metric.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <Card className="glass-panel border border-white/50">
          <CardContent className="space-y-4 p-6">
            <h2 className="text-2xl font-semibold text-slate-950">Validation dataset information</h2>
            <div className="space-y-3">
              {validationDatasetFacts.map((fact) => (
                <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4" key={fact.label}>
                  <p className="text-sm font-medium text-slate-500">{fact.label}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-950">{fact.value}</p>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{fact.description}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel border border-white/50">
          <CardContent className="space-y-4 p-6">
            <h2 className="text-2xl font-semibold text-slate-950">Limitations</h2>
            <div className="space-y-3">
              {modelLimitations.map((limitation) => (
                <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-900" key={limitation}>
                  {limitation}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="glass-panel border border-white/50">
        <CardContent className="space-y-4 p-6">
          <h2 className="text-2xl font-semibold text-slate-950">Research team and institution</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {researchTeam.map((member) => (
              <div className="rounded-[24px] border border-slate-200 bg-white/80 p-4 text-sm leading-7 text-slate-700" key={member}>
                {member}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel border border-amber-200/80 bg-amber-50/90">
        <CardContent className="space-y-3 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-700">Clinical disclaimer</p>
          <p className="text-sm leading-8 text-amber-950">{CLINICAL_DISCLAIMER}</p>
        </CardContent>
      </Card>
    </div>
  );
}
