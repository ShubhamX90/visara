"use client";

import { RouteErrorState } from "@/components/layout/route-error-state";

export default function AuthError({
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteErrorState
      description="The authentication screen could not be prepared. Please retry the route or return to the dashboard entry point."
      reset={reset}
      title="Unable to load sign-in"
    />
  );
}

