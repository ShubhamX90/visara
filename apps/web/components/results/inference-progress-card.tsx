"use client";

import { motion } from "framer-motion";
import { BrainCircuit, Clock3, Layers3, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { INFERENCE_STEPS } from "@/lib/constants";
import type { InferenceStepId } from "@/lib/types";
import { cn } from "@/lib/utils";

interface InferenceProgressCardProps {
  currentStep: InferenceStepId;
  progress: number;
  estimatedSecondsRemaining: number;
  className?: string;
}

const stepIcons = {
  preprocessing: Clock3,
  analysis: BrainCircuit,
  overlays: Layers3,
  results: Sparkles
} as const;

export function InferenceProgressCard({
  currentStep,
  progress,
  estimatedSecondsRemaining,
  className
}: InferenceProgressCardProps) {
  const activeIndex = INFERENCE_STEPS.findIndex((step) => step.id === currentStep);

  return (
    <Card className={cn("glass-panel relative overflow-hidden border border-white/50", className)}>
      <motion.div
        animate={{ opacity: [0.15, 0.28, 0.15], scale: [0.96, 1.02, 0.96] }}
        className="pointer-events-none absolute -top-24 right-10 h-52 w-52 rounded-full bg-primary/20 blur-3xl"
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      <CardHeader className="relative space-y-3">
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          AI-assisted processing
        </div>
        <CardTitle className="text-2xl text-slate-950">Preparing a clinician-friendly result surface</CardTitle>
        <p className="max-w-2xl text-sm leading-6 text-slate-600">
          The processing state stays transparent throughout the 10 to 15 second window so clinicians and technicians are never left with a blank waiting screen.
        </p>
      </CardHeader>
      <CardContent className="relative space-y-6">
        <div className="rounded-[24px] border border-slate-200 bg-white/80 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Estimated time remaining</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">{estimatedSecondsRemaining}s</p>
            </div>
            <p className="text-sm font-medium text-slate-600">{progress}% complete</p>
          </div>
          <div className="mt-4">
            <Progress className="h-3" indicatorClassName="bg-gradient-to-r from-cyan-500 to-sky-500" value={progress} />
          </div>
        </div>
        <div className="space-y-3">
          {INFERENCE_STEPS.map((step, index) => {
            const state = index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending";
            const Icon = stepIcons[step.id];

            return (
              <div
                key={step.id}
                className={cn(
                  "rounded-[24px] border px-4 py-4 transition",
                  state === "active" && "border-sky-200 bg-sky-50",
                  state === "complete" && "border-emerald-200 bg-emerald-50/80",
                  state === "pending" && "border-slate-200 bg-white/80"
                )}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={cn(
                      "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
                      state === "active" && "bg-primary text-white",
                      state === "complete" && "bg-emerald-500 text-white",
                      state === "pending" && "bg-slate-100 text-slate-500"
                    )}
                  >
                    {state === "active" ? (
                      <motion.span
                        animate={{ opacity: [0.2, 0.45, 0.2], scale: [1, 1.2, 1] }}
                        className="absolute inset-0 rounded-2xl bg-primary"
                        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                      />
                    ) : null}
                    <Icon className="relative h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-950">{step.label}</p>
                      <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500 ring-1 ring-slate-200">
                        {state}
                      </span>
                    </div>
                    <p className="text-sm leading-6 text-slate-600">{step.helper}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

