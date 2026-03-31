import type { Metadata } from "next";
import { DashboardPageClient } from "@/components/pages/dashboard-page-client";

export const metadata: Metadata = {
  title: "Dashboard | Visara",
  description: "Monitor case volume, referral activity, and model readiness from the Visara dashboard."
};

export default function DashboardPage() {
  return <DashboardPageClient />;
}
