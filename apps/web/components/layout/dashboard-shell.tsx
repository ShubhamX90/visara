"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { AppHeader } from "@/components/layout/app-header";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import type { ReactNode } from "react";

interface DashboardShellProps {
  children: ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname() ?? "/dashboard";

  return (
    <div className="min-h-screen">
      <div className="mx-auto flex max-w-[1600px]">
        <aside className="sticky top-0 hidden h-screen w-[320px] shrink-0 border-r border-white/[0.08] bg-[#0B1222] lg:block">
          <SidebarNav pathname={pathname} />
        </aside>
        <div className="flex min-h-screen flex-1 flex-col">
          <AppHeader onOpenNavigation={() => setMobileOpen(true)} pathname={pathname} />
          <main className="flex-1 px-4 py-6 md:px-6 lg:px-8">{children}</main>
        </div>
      </div>
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 bg-slate-950/65 backdrop-blur-sm lg:hidden">
          <div className="absolute inset-y-0 left-0 w-[86vw] max-w-sm p-4">
            <button
              aria-label="Close navigation"
              className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.08] text-white"
              onClick={() => setMobileOpen(false)}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarNav mobile onNavigate={() => setMobileOpen(false)} pathname={pathname} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
