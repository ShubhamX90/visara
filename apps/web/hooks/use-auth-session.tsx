"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { clearStoredAccessToken, getStoredAccessToken, setStoredAccessToken } from "@/lib/auth";

interface AuthSessionContextValue {
  hydrated: boolean;
  token: string | null;
  clearToken: () => void;
  setToken: (token: string) => void;
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setTokenState(getStoredAccessToken());
    setHydrated(true);
  }, []);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      hydrated,
      token,
      clearToken() {
        clearStoredAccessToken();
        setTokenState(null);
      },
      setToken(nextToken: string) {
        setStoredAccessToken(nextToken);
        setTokenState(nextToken);
      }
    }),
    [hydrated, token]
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);
  if (!context) {
    throw new Error("useAuthSession must be used within an AuthSessionProvider.");
  }

  return context;
}
