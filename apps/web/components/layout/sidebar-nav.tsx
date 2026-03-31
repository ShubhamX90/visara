"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Activity, History, LayoutDashboard, LogOut, Microscope, PlusSquare, Settings } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCurrentUser, useLogout } from "@/hooks/use-auth";
import { useAuthSession } from "@/hooks/use-auth-session";
import { useHealthStatus } from "@/hooks/use-inference";
import { mainNavigation } from "@/lib/navigation";
import { cn, formatDateTime, getInitials } from "@/lib/utils";

interface SidebarNavProps {
  pathname: string;
  mobile?: boolean;
  onNavigate?: () => void;
}

const icons = {
  "/dashboard": LayoutDashboard,
  "/upload": PlusSquare,
  "/history": History,
  "/model": Microscope,
  "/settings": Settings
} as const;

export function SidebarNav({ pathname, mobile = false, onNavigate }: SidebarNavProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { clearToken, token } = useAuthSession();
  const userQuery = useCurrentUser(token);
  const logoutMutation = useLogout();
  const healthQuery = useHealthStatus();
  const sidebarModelStatus = healthQuery.data
    ? {
        version: healthQuery.data.model_version,
        lastUpdated: healthQuery.data.timestamp,
        operationalStatus: healthQuery.data.status === "operational" ? "operational" : "monitoring",
        summary: healthQuery.data.model_loaded
          ? "Inference weights are loaded and ready for live requests."
          : "The model loader is still initializing. New uploads will remain queued until it becomes ready."
      }
    : {
        version: "visara-v3",
        lastUpdated: new Date().toISOString(),
        operationalStatus: "monitoring" as const,
        summary: "Health status is temporarily unavailable while the client reconnects to the API."
      };
  const displayName = userQuery.data?.full_name ?? "Clinical reviewer";
  const displayRole =
    userQuery.data?.role === "admin" ? "Administrator" : userQuery.data?.role === "doctor" ? "Doctor" : "Technician";
  const displayInstitution = userQuery.data?.institution ?? "BITS Pilani Research Project";

  async function handleLogout() {
    onNavigate?.();

    try {
      if (token) {
        await logoutMutation.mutateAsync(token);
      }
    } catch {}

    clearToken();
    queryClient.clear();
    router.push("/login");
  }

  return (
    <div
      className={cn(
        "flex h-full flex-col gap-6",
        mobile ? "rounded-[32px] border border-white/[0.12] bg-[#0B1222] p-6" : "px-4 py-6"
      )}
    >
      <div className="px-2">
        <Logo className="justify-start" inverted />
      </div>
      <nav className="space-y-2">
        {mainNavigation.map((item) => {
          const Icon = icons[item.href];
          const isActive = item.matchers.some((matcher) =>
            matcher === "/cases" ? pathname.startsWith("/cases") : pathname.startsWith(matcher)
          );

          return (
            <Link
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition",
                isActive
                  ? "border-white/40 bg-white text-slate-950 shadow-[0_18px_40px_rgba(15,22,41,0.24)]"
                  : "border-transparent text-slate-300 hover:border-white/10 hover:bg-white/10 hover:text-white"
              )}
              href={item.href as Route}
              key={item.href}
              onClick={onNavigate}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <Card className="border border-white/[0.12] bg-white/[0.06] text-white shadow-none">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Activity className="h-4 w-4 text-emerald-300" />
            Model status
          </div>
          <div className="space-y-1 text-sm text-slate-200">
            <p className="font-medium">{sidebarModelStatus.version}</p>
            <p className="text-slate-400">
              {healthQuery.isLoading ? "Checking service health..." : `Updated ${formatDateTime(sidebarModelStatus.lastUpdated)}`}
            </p>
          </div>
          {healthQuery.isError ? (
            <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
              Live health data is temporarily unavailable, so the sidebar is showing the last known operational summary.
            </div>
          ) : null}
          <div
            className={cn(
              "inline-flex w-fit items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold",
              sidebarModelStatus.operationalStatus === "operational"
                ? "bg-emerald-500/15 text-emerald-200"
                : "bg-amber-500/15 text-amber-100"
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                sidebarModelStatus.operationalStatus === "operational" ? "bg-emerald-300" : "bg-amber-300"
              )}
            />
            {sidebarModelStatus.operationalStatus === "operational" ? "Operational" : "Monitoring"}
          </div>
        </CardContent>
      </Card>
      <div className="mt-auto rounded-[28px] border border-white/[0.12] bg-white/[0.06] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-sm font-semibold text-slate-950">
            {getInitials(displayName) || "VR"}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{displayName}</p>
            <p className="truncate text-xs text-slate-400">
              {displayRole} | {displayInstitution}
            </p>
          </div>
        </div>
        <Button className="mt-4 w-full justify-start" disabled={logoutMutation.isPending} onClick={() => void handleLogout()} variant="ghost">
          <LogOut className="mr-2 h-4 w-4" />
          {logoutMutation.isPending ? "Signing out..." : "Log out"}
        </Button>
      </div>
    </div>
  );
}
