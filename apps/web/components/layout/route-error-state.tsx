"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface RouteErrorStateProps {
  title: string;
  description: string;
  reset: () => void;
}

export function RouteErrorState({ title, description, reset }: RouteErrorStateProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="glass-panel max-w-xl border border-rose-100">
        <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-50 text-rose-600">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-slate-950">{title}</h2>
            <p className="text-sm leading-7 text-slate-600">{description}</p>
          </div>
          <Button onClick={reset} type="button">
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

