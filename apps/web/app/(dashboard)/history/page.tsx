import type { Metadata } from "next";
import { HistoryPageClient } from "@/components/pages/history-page-client";

export const metadata: Metadata = {
  title: "History | Visara",
  description: "Review historical diabetic retinopathy screening cases with filters and pagination."
};

export default function HistoryPage() {
  return <HistoryPageClient />;
}
