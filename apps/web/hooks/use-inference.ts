"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApiErrorResponse, HealthResponse } from "@/lib/types";

export function useHealthStatus() {
  return useQuery<HealthResponse, ApiErrorResponse>({
    queryFn: () => api.getHealth(),
    queryKey: ["health"]
  });
}
