"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLogin } from "@/hooks/use-auth";
import { useAuthSession } from "@/hooks/use-auth-session";
import { CLINICAL_DISCLAIMER } from "@/lib/constants";
import { mockCurrentUser } from "@/lib/mock-data";

export function LoginPageClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const loginMutation = useLogin();
  const { hydrated, setToken, token } = useAuthSession();
  const [email, setEmail] = useState(mockCurrentUser.email);
  const [password, setPassword] = useState("VisaraDemo123!");

  useEffect(() => {
    if (hydrated && token) {
      router.replace("/dashboard");
    }
  }, [hydrated, router, token]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await loginMutation.mutateAsync({ email, password });
      setToken(response.access_token);
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      router.push("/dashboard");
    } catch {}
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="grid w-full max-w-[1180px] gap-8 lg:grid-cols-[1.1fr,0.9fr] lg:items-center">
        <section className="hidden space-y-6 lg:block">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.08] px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-100">
            <ShieldCheck className="h-3.5 w-3.5" />
            BITS Pilani Research Project
          </div>
          <div className="space-y-4">
            <h1 className="max-w-2xl text-5xl font-semibold tracking-tight text-white">
              Premium clinical review surfaces for diabetic retinopathy screening.
            </h1>
            <p className="max-w-2xl text-base leading-8 text-slate-200">
              Visara is designed as a calm clinical decision-support workspace for ophthalmologists, retina specialists, and screening technicians reviewing AI-assisted retinal findings.
            </p>
          </div>
          <div className="grid max-w-2xl gap-4 md:grid-cols-2">
            <Card className="border border-white/[0.12] bg-white/[0.08] text-white shadow-none">
              <CardContent className="space-y-2 p-5">
                <p className="text-sm font-medium text-sky-100">Institutional context</p>
                <p className="text-sm leading-7 text-slate-200">{mockCurrentUser.institution}</p>
              </CardContent>
            </Card>
            <Card className="border border-white/[0.12] bg-white/[0.08] text-white shadow-none">
              <CardContent className="space-y-2 p-5">
                <p className="text-sm font-medium text-sky-100">Access tier</p>
                <p className="text-sm leading-7 text-slate-200">Research and evaluation environment for clinician-facing workflow prototyping.</p>
              </CardContent>
            </Card>
          </div>
        </section>
        <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-5">
          <Card className="w-full border border-white/[0.12] bg-white/[0.08] text-white shadow-glow">
            <CardContent className="space-y-6 p-8 sm:p-10">
              <div className="space-y-5">
                <Logo href="/login" inverted />
                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-white/[0.08] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">
                  BITS Pilani Research Project
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-semibold tracking-tight text-white">Sign in to the screening workspace</h2>
                  <p className="text-sm leading-7 text-slate-300">
                    Use your institutional credentials to access the Visara screening workspace and review clinical decision-support outputs.
                  </p>
                </div>
              </div>
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-sky-50" htmlFor="email">
                    Email
                  </label>
                  <Input id="email" onChange={(event) => setEmail(event.target.value)} type="email" value={email} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-sky-50" htmlFor="password">
                    Password
                  </label>
                  <Input id="password" onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
                </div>
                {loginMutation.isError ? (
                  <div className="rounded-[20px] border border-rose-300 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                    {loginMutation.error.message}
                  </div>
                ) : null}
                <Button className="h-12 w-full text-base" disabled={loginMutation.isPending} size="lg" type="submit">
                  {loginMutation.isPending ? "Signing in..." : "Open Visara"}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
          <p className="max-w-lg text-center text-sm leading-7 text-slate-400">{CLINICAL_DISCLAIMER}</p>
        </div>
      </div>
    </main>
  );
}
