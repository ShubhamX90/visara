"use client";

import { useQuery } from "@tanstack/react-query";
import { api, resolveApiUrl } from "@/lib/api";
import type { ApiErrorResponse } from "@/lib/types";

export function useAssetUrl(path: string | null | undefined, token: string | null) {
  return useQuery<string, ApiErrorResponse>({
    enabled: Boolean(path && token),
    queryFn: async () => {
      const assetBlob = await api.fetchAsset(path ?? "", token ?? "");
      return URL.createObjectURL(assetBlob);
    },
    queryKey: ["asset", resolveApiUrl(path ?? ""), token],
    staleTime: 60_000
  });
}
