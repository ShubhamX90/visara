import type { Route } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface LogoProps {
  href?: Route;
  compact?: boolean;
  inverted?: boolean;
  className?: string;
}

export function Logo({ href = "/dashboard", compact = false, inverted = false, className }: LogoProps) {
  const content = (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className={cn(
          "relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl",
          inverted ? "bg-white text-slate-950" : "bg-gradient-to-br from-sky-400 to-cyan-300 text-slate-950"
        )}
      >
        <div className="absolute inset-2 rounded-[14px] border border-slate-950/10" />
        <span className="text-base font-black tracking-[0.2em]">V</span>
      </div>
      {compact ? null : (
        <div className="min-w-0">
          <p className={cn("text-lg font-semibold tracking-tight", inverted ? "text-white" : "text-slate-950")}>
            Visara
          </p>
          <p className={cn("text-xs", inverted ? "text-slate-300" : "text-slate-500")}>
            Diabetic retinopathy decision support
          </p>
        </div>
      )}
    </div>
  );

  return <Link href={href}>{content}</Link>;
}
