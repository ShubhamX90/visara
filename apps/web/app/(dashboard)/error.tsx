"use client";

import { RouteErrorState } from "@/components/layout/route-error-state";

export default function DashboardError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorState
      description="The requested dashboard route could not be prepared. Please retry or return to a different navigation destination."
      reset={reset}
      title="Unable to load this workspace"
    />
  );
}

