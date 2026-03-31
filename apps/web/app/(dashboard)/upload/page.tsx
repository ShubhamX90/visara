import type { Metadata } from "next";
import { UploadPageClient } from "@/components/pages/upload-page-client";

export const metadata: Metadata = {
  title: "Upload | Visara",
  description: "Upload a new retinal screening case with privacy-safe patient reference details."
};

export default function UploadPage() {
  return <UploadPageClient />;
}
