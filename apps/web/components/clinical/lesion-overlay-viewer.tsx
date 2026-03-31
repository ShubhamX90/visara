"use client";

import Image from "next/image";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, Layers3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { LesionChannelId, LesionOverlay } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LesionOverlayViewerProps {
  imageSrc: string;
  overlays: LesionOverlay[];
  defaultVisible?: LesionChannelId[];
  className?: string;
}

export function LesionOverlayViewer({
  imageSrc,
  overlays,
  defaultVisible,
  className
}: LesionOverlayViewerProps) {
  const [visibleIds, setVisibleIds] = useState<Set<LesionChannelId>>(
    () => new Set(defaultVisible ?? overlays.slice(0, 3).map((overlay) => overlay.id))
  );

  function toggleOverlay(id: LesionChannelId) {
    setVisibleIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function setAll(active: boolean) {
    setVisibleIds(new Set(active ? overlays.map((overlay) => overlay.id) : []));
  }

  return (
    <Card className={cn("glass-panel overflow-hidden border border-white/50", className)}>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <div className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
            <Layers3 className="h-3.5 w-3.5" />
            Lesion overlay viewer
          </div>
          <CardTitle className="text-2xl text-slate-950">Review predicted lesion channels over the original fundus image</CardTitle>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            The original fundus image remains visible underneath every overlay so clinicians can assess the suggested regions in context.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            aria-label="Show all lesion overlays"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            onClick={() => setAll(true)}
            type="button"
          >
            Show all
          </button>
          <button
            aria-label="Clear all lesion overlays"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            onClick={() => setAll(false)}
            type="button"
          >
            Clear
          </button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <div className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 p-3">
          <div className="relative aspect-square overflow-hidden rounded-[22px]">
            <Image alt="Fundus photograph" className="object-cover" fill sizes="(min-width: 1280px) 60vw, 100vw" src={imageSrc} unoptimized />
            <AnimatePresence>
              {overlays.map((overlay) =>
                visibleIds.has(overlay.id) ? (
                  <motion.div
                    key={overlay.id}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 mix-blend-screen"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.95 }}
                    exit={{ opacity: 0 }}
                  >
                    {overlay.overlaySrc ? (
                      <Image alt="" className="object-cover" fill sizes="(min-width: 1280px) 60vw, 100vw" src={overlay.overlaySrc} unoptimized />
                    ) : null}
                  </motion.div>
                ) : null
              )}
            </AnimatePresence>
          </div>
          <div className="pointer-events-none absolute left-6 top-6 rounded-full bg-slate-950/[0.72] px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
            Original underlay retained
          </div>
          <div className="pointer-events-none absolute bottom-6 left-6 rounded-full bg-white/[0.12] px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
            {visibleIds.size} / {overlays.length} overlays active
          </div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white/80 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Eye className="h-4 w-4 text-primary" />
            Channel legend and visibility
          </div>
          <div className="space-y-3">
            {overlays.map((overlay) => {
              const isActive = visibleIds.has(overlay.id);

              return (
                <div
                  key={overlay.id}
                  className={cn(
                    "rounded-[22px] border p-4 transition",
                    isActive ? "border-slate-300 bg-slate-50" : "border-slate-200 bg-white"
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      <span
                        className="mt-1 h-4 w-4 rounded-full border border-white/80 shadow-sm"
                        style={{ backgroundColor: overlay.swatch }}
                      />
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{overlay.label}</p>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            {overlay.shortLabel}
                          </span>
                        </div>
                        <p className="text-sm leading-6 text-slate-600">{overlay.description}</p>
                      </div>
                    </div>
                    <Switch
                      aria-label={`Toggle ${overlay.label} overlay`}
                      checked={isActive}
                      onCheckedChange={() => toggleOverlay(overlay.id)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
