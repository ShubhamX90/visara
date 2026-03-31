import type { Route } from "next";
import type { BreadcrumbItem } from "@/lib/types";

export const mainNavigation = [
  {
    href: "/dashboard",
    label: "Dashboard",
    matchers: ["/dashboard"]
  },
  {
    href: "/upload",
    label: "New Case",
    matchers: ["/upload"]
  },
  {
    href: "/history",
    label: "History",
    matchers: ["/history", "/cases"]
  },
  {
    href: "/model",
    label: "Model",
    matchers: ["/model"]
  },
  {
    href: "/settings",
    label: "Settings",
    matchers: ["/settings"]
  }
] as const;

function getCaseLabel(caseId: string) {
  return caseId;
}

export function getBreadcrumbs(pathname: string): BreadcrumbItem[] {
  if (pathname === "/login") {
    return [{ label: "Sign In" }];
  }

  if (pathname === "/dashboard") {
    return [{ label: "Dashboard" }];
  }

  if (pathname === "/upload") {
    return [{ label: "Dashboard", href: "/dashboard" }, { label: "New Case" }];
  }

  if (pathname === "/history") {
    return [{ label: "Dashboard", href: "/dashboard" }, { label: "History" }];
  }

  if (pathname === "/model") {
    return [{ label: "Dashboard", href: "/dashboard" }, { label: "Model" }];
  }

  if (pathname === "/settings") {
    return [{ label: "Dashboard", href: "/dashboard" }, { label: "Settings" }];
  }

  if (pathname.startsWith("/cases/")) {
    const segments = pathname.split("/").filter(Boolean);
    const caseId = segments[1];
    const report = segments[2] === "report";
    const baseCrumbs: BreadcrumbItem[] = [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Cases", href: "/history" },
      { label: getCaseLabel(caseId), href: `/cases/${caseId}` as Route }
    ];

    return report ? [...baseCrumbs, { label: "Report" }] : baseCrumbs;
  }

  return [{ label: "Dashboard", href: "/dashboard" }];
}

export function getPageMeta(pathname: string) {
  if (pathname === "/dashboard") {
    return {
      title: "Clinical Dashboard",
      subtitle: "Monitor screening activity, recent cases, and model readiness from one calm workspace."
    };
  }

  if (pathname === "/upload") {
    return {
      title: "New Case Upload",
      subtitle: "Prepare a privacy-safe case record and submit a full-quality retinal image for analysis."
    };
  }

  if (pathname === "/history") {
    return {
      title: "Case History",
      subtitle: "Review previous screens with filterable referral and grade-based triage."
    };
  }

  if (pathname === "/model") {
    return {
      title: "Model and Validation",
      subtitle: "Explain the research model, clinical framing, and known limitations in plain language."
    };
  }

  if (pathname === "/settings") {
    return {
      title: "Settings",
      subtitle: "Manage profile, notifications, report defaults, and authentication details."
    };
  }

  if (pathname.startsWith("/cases/") && pathname.endsWith("/report")) {
    return {
      title: "Report Preview",
      subtitle: "Review the print-ready summary that clinicians can export as a PDF report."
    };
  }

  if (pathname.startsWith("/cases/")) {
    return {
      title: "Results Dashboard",
      subtitle: "Referral-first review of grade, confidence, lesions, and case metadata."
    };
  }

  return {
    title: "Visara",
    subtitle: "Clinical decision-support workspace"
  };
}
