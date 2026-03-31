"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ApiErrorResponse, AuthTokenResponse, LoginRequest, UserResponse } from "@/lib/types";

export function useLogin() {
  return useMutation<AuthTokenResponse, ApiErrorResponse, LoginRequest>({
    mutationFn: (payload: LoginRequest) => api.login(payload)
  });
}

export function useLogout() {
  return useMutation<{ message: string }, ApiErrorResponse, string>({
    mutationFn: (token: string) => api.logout(token)
  });
}

export function useCurrentUser(token: string | null) {
  return useQuery<UserResponse, ApiErrorResponse>({
    enabled: Boolean(token),
    queryFn: () => api.getCurrentUser(token ?? ""),
    queryKey: ["auth", "me", token]
  });
}
