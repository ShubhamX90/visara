import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/layout/logo";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <Card className="glass-panel w-full max-w-xl border border-white/40">
        <CardContent className="space-y-6 p-10 text-center">
          <div className="flex justify-center">
            <Logo compact />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-slate-950">Page not found</h1>
            <p className="text-sm leading-7 text-slate-600">
              The requested Visara route could not be located. Return to the login screen or continue into the dashboard workspace.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild variant="outline">
              <Link href="/login">Go to login</Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

