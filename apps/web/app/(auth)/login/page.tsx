import type { Metadata } from "next";
import { LoginPageClient } from "@/components/pages/login-page-client";

export const metadata: Metadata = {
  title: "Login | Visara",
  description: "Sign in to the Visara clinical decision-support workspace."
};

export default function LoginPage() {
  return <LoginPageClient />;
}
