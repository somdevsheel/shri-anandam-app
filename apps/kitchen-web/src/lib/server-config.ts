/** Same pattern as apps/admin-web/src/lib/server-config.ts (ADR-020) — kitchen-web is its own app with its own login session, not sharing admin-web's cookie (different origin in any real deployment). */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export const REFRESH_COOKIE_NAME = "sa_kitchen_refresh_token";

export function refreshCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth",
    maxAge: maxAgeSeconds,
  };
}
