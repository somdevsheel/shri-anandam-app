/** Server-side (Route Handler) API base URL. Same var as the client uses (NEXT_PUBLIC_*) — the backend URL isn't a secret, unlike the refresh token these routes handle. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export const REFRESH_COOKIE_NAME = "sa_refresh_token";

/** Shared cookie options for setting the httpOnly refresh-token cookie — kept in one place so login/refresh can't drift out of sync on options that must match for delete()/rotation to work (path, in particular). */
export function refreshCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/api/auth",
    maxAge: maxAgeSeconds,
  };
}
