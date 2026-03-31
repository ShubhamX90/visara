import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function AppShellLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-4 w-[30rem] max-w-full" />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card className="border border-white/10 bg-white/[0.08]" key={index}>
            <CardContent className="space-y-4 p-6">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="border border-white/10 bg-white/[0.08]">
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-56 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export function AuthLoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <Card className="w-full max-w-md border border-white/[0.12] bg-white/[0.08] text-white">
        <CardContent className="space-y-5 p-8">
          <Skeleton className="h-12 w-12 rounded-2xl bg-white/15" />
          <Skeleton className="h-6 w-40 bg-white/15" />
          <Skeleton className="h-4 w-56 bg-white/10" />
          <Skeleton className="h-11 w-full bg-white/10" />
          <Skeleton className="h-11 w-full bg-white/10" />
          <Skeleton className="h-11 w-full bg-white/15" />
        </CardContent>
      </Card>
    </div>
  );
}

