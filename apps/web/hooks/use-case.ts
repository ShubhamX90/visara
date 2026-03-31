"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApiErrorResponse, CaseListResponse, CaseResponse } from "@/lib/types";

export function useCreateCase() {
  return useMutation<CaseResponse, ApiErrorResponse, { formData: FormData; token: string }>({
    mutationFn: ({ formData, token }: { formData: FormData; token: string }) => api.createCase(formData, token)
  });
}

export function useCase(caseId: string, token: string | null) {
  return useQuery<CaseResponse, ApiErrorResponse>({
    enabled: Boolean(caseId && token),
    queryFn: () => api.getCase(caseId, token ?? undefined),
    queryKey: ["case", caseId, token],
    refetchInterval: (query) => (query.state.data?.status === "processing" ? 2000 : false)
  });
}

export function useCases(queryString = "", token: string | null = null) {
  return useQuery<CaseListResponse, ApiErrorResponse>({
    enabled: Boolean(token),
    queryFn: () => api.listCases(queryString, token ?? undefined),
    queryKey: ["cases", queryString, token]
  });
}
