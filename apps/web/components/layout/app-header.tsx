"use client";

import type { Route } from "next";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-auth";
import { useAuthSession } from "@/hooks/use-auth-session";
import { getBreadcrumbs, getPageMeta } from "@/lib/navigation";

interface AppHeaderProps {
  pathname: string;
  onOpenNavigation: () => void;
}

export function AppHeader({ pathname, onOpenNavigation }: AppHeaderProps) {
  const { token } = useAuthSession();
  const userQuery = useCurrentUser(token);
  const breadcrumbs = getBreadcrumbs(pathname);
  const pageMeta = getPageMeta(pathname);
  const displayName = userQuery.data?.full_name ?? "Clinical reviewer";
  const displayInstitution = userQuery.data?.institution ?? "BITS Pilani Research Project";

  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#0F1629]/90 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-4 md:px-6 lg:px-8">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100/80">
            <Button className="h-9 px-3 lg:hidden" onClick={onOpenNavigation} size="sm" type="button" variant="ghost">
              <Menu className="h-4 w-4" />
            </Button>
            <span className="text-white md:hidden">{breadcrumbs[breadcrumbs.length - 1]?.label}</span>
            <div className="hidden flex-wrap items-center gap-2 md:flex">
              {breadcrumbs.map((crumb, index) => (
                <div className="flex items-center gap-2" key={`${crumb.label}-${index}`}>
                  {crumb.href && index !== breadcrumbs.length - 1 ? (
                    <Link className="transition hover:text-white" href={crumb.href as Route}>
                      {crumb.label}
                    </Link>
                  ) : (
                    <span className="text-white">{crumb.label}</span>
                  )}
                  {index === breadcrumbs.length - 1 ? null : <span>/</span>}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">{pageMeta.title}</h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-300">{pageMeta.subtitle}</p>
          </div>
        </div>
        <div className="hidden rounded-full border border-white/[0.12] bg-white/[0.06] px-4 py-2 text-right md:block">
          <p className="text-sm font-semibold text-white">{displayName}</p>
          <p className="text-xs text-slate-400">{displayInstitution}</p>
        </div>
      </div>
    </header>
  );
}
