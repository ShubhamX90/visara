import type { Route } from "next";
import Link from "next/link";
import { ArrowRight, FolderOpenDot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface EmptyStateProps {
  title: string;
  description: string;
  actionHref?: Route;
  actionLabel?: string;
}

export function EmptyState({ title, description, actionHref, actionLabel }: EmptyStateProps) {
  return (
    <Card className="glass-panel border border-white/40">
      <CardContent className="flex flex-col items-center justify-center gap-4 p-10 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-950 text-white">
          <FolderOpenDot className="h-7 w-7" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-slate-950">{title}</h3>
          <p className="max-w-xl text-sm leading-7 text-slate-600">{description}</p>
        </div>
        {actionHref && actionLabel ? (
          <Button asChild>
            <Link href={actionHref}>
              {actionLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
