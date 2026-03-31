"use client";

import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApiErrorResponse } from "@/lib/types";

export function useReportDownloadUrl(caseId: string) {
  return api.getReportUrl(caseId);
}

export function useDownloadReport() {
  return useMutation<Blob, ApiErrorResponse, { caseId: string; token: string }>({
    mutationFn: ({ caseId, token }: { caseId: string; token: string }) => api.downloadReport(caseId, token)
  });
}
