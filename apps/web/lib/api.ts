import type {
  ApiErrorResponse,
  ApiLesionChannelId,
  AuthTokenResponse,
  CaseListResponse,
  CaseResponse,
  HealthResponse,
  LoginRequest,
  UserResponse
} from "@/lib/types";

const API_PREFIX = "/api/v1";

function getApiBaseUrl() {
  return (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
}

function buildApiUrl(path: string) {
  return `${getApiBaseUrl()}${API_PREFIX}${path}`;
}

export function resolveApiUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  if (path.startsWith(API_PREFIX)) {
    return `${getApiBaseUrl()}${path}`;
  }

  return buildApiUrl(path);
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(resolveApiUrl(path), {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    let errorPayload: ApiErrorResponse = {
      code: "HTTP_ERROR",
      message: "Request failed.",
      detail: response.statusText
    };

    try {
      errorPayload = (await response.json()) as ApiErrorResponse;
    } catch {}

    throw errorPayload;
  }

  return (await response.json()) as T;
}

export const api = {
  async createCase(formData: FormData, token: string) {
    const response = await fetch(buildApiUrl("/cases"), {
      body: formData,
      headers: {
        Authorization: `Bearer ${token}`
      },
      method: "POST"
    });

    if (!response.ok) {
      let errorPayload: ApiErrorResponse = {
        code: "HTTP_ERROR",
        message: "Request failed.",
        detail: response.statusText
      };

      try {
        errorPayload = (await response.json()) as ApiErrorResponse;
      } catch {}

      throw errorPayload;
    }

    return (await response.json()) as CaseResponse;
  },
  login(payload: LoginRequest) {
    return apiRequest<AuthTokenResponse>("/auth/login", {
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
  },
  logout(token: string) {
    return apiRequest<{ message: string }>("/auth/logout", {
      headers: { Authorization: `Bearer ${token}` },
      method: "POST"
    });
  },
  getCurrentUser(token: string) {
    return apiRequest<UserResponse>("/auth/me", {
      headers: { Authorization: `Bearer ${token}` }
    });
  },
  getHealth() {
    return apiRequest<HealthResponse>("/health");
  },
  listCases(queryString = "", token?: string) {
    return apiRequest<CaseListResponse>(`/cases${queryString}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
  },
  getCase(caseId: string, token?: string) {
    return apiRequest<CaseResponse>(`/cases/${caseId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined
    });
  },
  getOverlayUrl(caseId: string, channel: ApiLesionChannelId) {
    return buildApiUrl(`/cases/${caseId}/overlays/${channel}`);
  },
  async fetchAsset(path: string, token: string) {
    const response = await fetch(resolveApiUrl(path), {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      let errorPayload: ApiErrorResponse = {
        code: "HTTP_ERROR",
        message: "Request failed.",
        detail: response.statusText
      };

      try {
        errorPayload = (await response.json()) as ApiErrorResponse;
      } catch {}

      throw errorPayload;
    }

    return response.blob();
  },
  getReportUrl(caseId: string) {
    return buildApiUrl(`/cases/${caseId}/report`);
  },
  async downloadReport(caseId: string, token: string) {
    const response = await fetch(buildApiUrl(`/cases/${caseId}/report`), {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      let errorPayload: ApiErrorResponse = {
        code: "HTTP_ERROR",
        message: "Request failed.",
        detail: response.statusText
      };

      try {
        errorPayload = (await response.json()) as ApiErrorResponse;
      } catch {}

      throw errorPayload;
    }

    return response.blob();
  }
};
