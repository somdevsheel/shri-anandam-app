"use client";

import type { ApiErrorResponse, ApiResponse } from "@shri-anandam/shared-types";
import { useAuthStore } from "./auth-store";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

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
  method?: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
  isRetry?: boolean;
}

/**
 * Same single-flight-refresh shape as the mobile apps' clients, but the
 * refresh call goes to OUR /api/auth/refresh route (which holds the
 * httpOnly cookie), not directly to services/api — see ADR-020. Every
 * other call here goes straight to services/api from the browser (CORS
 * is already allow-listed per docs/architecture/security-architecture.md),
 * not proxied through Next.js, since there's nothing sensitive in those
 * requests that a proxy hop would protect.
 */
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function doRefresh(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/refresh", { method: "POST" });
    const json = (await res.json()) as ApiResponse<{ accessToken: string }>;
    if (!res.ok || !json.success) {
      await useAuthStore.getState().clear();
      return false;
    }
    useAuthStore.getState().setAccessToken(json.data.accessToken);
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
      const refreshed = await refreshAccessToken();
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
