import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/app/globals.css";
import { AuthSessionProvider } from "@/hooks/use-auth-session";
import { QueryProvider } from "@/components/providers/query-provider";

export const metadata: Metadata = {
  title: "Visara | Clinical Decision Support",
  description:
    "Visara frontend shell for AI-assisted diabetic retinopathy screening with referral-first clinical review surfaces."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <QueryProvider>
          <AuthSessionProvider>{children}</AuthSessionProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
