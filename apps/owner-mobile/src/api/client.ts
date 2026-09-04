import Constants from "expo-constants";
import type { ApiErrorResponse, ApiResponse } from "@shri-anandam/shared-types";
import { useAuthStore } from "@/lib/auth-store";

const API_URL = (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details: ApiErrorResponse["error"]["details"] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Skip attaching the Authorization header — for the login endpoint itself. */
  skipAuth?: boolean;
  /** Internal — prevents the 401-refresh-retry from recursing past one attempt. */
  isRetry?: boolean;
}

/**
 * Same single-flight refresh pattern as apps/customer-mobile/src/api/client.ts
 * — the backend rotates refresh tokens on every use and revokes the whole
 * session on reuse of a stale one, so two concurrent 401s must await the
 * same in-flight refresh rather than racing two of their own.
 */
let refreshPromise: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function doRefresh(): Promise<boolean> {
  const { refreshToken, setTokens, clear } = useAuthStore.getState();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    const json = (await res.json()) as ApiResponse<{ accessToken: string; refreshToken: string }>;
    if (!res.ok || !json.success) {
      await clear();
      return false;
    }
    await setTokens({ accessToken: json.data.accessToken, refreshToken: json.data.refreshToken });
    return true;
  } catch {
    return false;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, skipAuth, isRetry } = options;

  const url = new URL(`${API_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (!skipAuth) {
    const { accessToken } = useAuthStore.getState();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!response.ok || !json || !json.success) {
    const error = json && !json.success ? json.error : null;

    if (response.status === 401 && !skipAuth && !isRetry) {
      const refreshed = await refreshTokens();
      if (refreshed) {
        return apiRequest<T>(path, { ...options, isRetry: true });
      }
    }

    throw new ApiError(
      error?.code ?? "NETWORK_ERROR",
      error?.message ?? "Something went wrong. Please try again.",
      response.status,
      error?.details ?? [],
    );
  }

  return json.data;
}
