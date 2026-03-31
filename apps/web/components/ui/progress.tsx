import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  indicatorClassName?: string;
}

export function Progress({
  className,
  value = 0,
  indicatorClassName,
  ...props
}: ProgressProps) {
  const safeValue = Math.max(0, Math.min(100, value));

  return (
    <div
      className={cn("relative h-2.5 w-full overflow-hidden rounded-full bg-slate-200/70", className)}
      {...props}
    >
      <div
        className={cn("progress-shimmer h-full rounded-full bg-primary transition-all duration-500", indicatorClassName)}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

