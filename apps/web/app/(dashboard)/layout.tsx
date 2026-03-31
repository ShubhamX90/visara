import { Suspense } from "react";
import type { ReactNode } from "react";
import { AppShellLoading } from "@/components/layout/app-shell-loading";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShell>
      <Suspense fallback={<AppShellLoading />}>{children}</Suspense>
    </DashboardShell>
  );
}

