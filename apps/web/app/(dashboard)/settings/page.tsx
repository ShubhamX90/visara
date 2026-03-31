import type { Metadata } from "next";
import { SettingsPageClient } from "@/components/pages/settings-page-client";

export const metadata: Metadata = {
  title: "Settings | Visara",
  description: "Manage profile preferences, notifications, export defaults, and password settings."
};

export default function SettingsPage() {
  return <SettingsPageClient />;
}
