import { Suspense } from "react";
import type { ReactNode } from "react";
import { AuthLoadingState } from "@/components/layout/app-shell-loading";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.22),transparent_30rem),linear-gradient(180deg,#09101F_0%,#0F1629_40%,#121B31_100%)]">
      <Suspense fallback={<AuthLoadingState />}>{children}</Suspense>
    </div>
  );
}

