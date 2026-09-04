import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { staffLoginSchema } from "@shri-anandam/validation";
import type { ApiResponse } from "@shri-anandam/shared-types";
import { API_URL, REFRESH_COOKIE_NAME, refreshCookieOptions } from "@/lib/server-config";

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Thin BFF over services/api's stateless Bearer-JWT auth (ADR-020): this
 * route is the ONLY place the refresh token exists outside services/api
 * itself — it never reaches the browser's JS. The access token (short-
 * lived, JWT_ACCESS_TTL=15m) is returned in the JSON body for the client
 * to hold in memory; every other admin-web request attaches it directly
 * to services/api as `Authorization: Bearer`, not proxied through here.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = staffLoginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid email or password format", details: [] }, requestId: "" },
      { status: 400 },
    );
  }

  const upstream = await fetch(`${API_URL}/auth/staff/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });
  const json = (await upstream.json().catch(() => null)) as ApiResponse<IssuedTokens> | null;

  if (!upstream.ok || !json || !json.success) {
    return NextResponse.json(json ?? { success: false, error: { code: "NETWORK_ERROR", message: "Sign in failed", details: [] }, requestId: "" }, {
      status: upstream.status || 502,
    });
  }

  const cookieStore = await cookies();
  cookieStore.set(REFRESH_COOKIE_NAME, json.data.refreshToken, refreshCookieOptions(30 * 24 * 60 * 60)); // JWT_REFRESH_TTL=30d

  return NextResponse.json({ success: true, data: { accessToken: json.data.accessToken, expiresIn: json.data.expiresIn }, requestId: json.requestId } satisfies ApiResponse<{
    accessToken: string;
    expiresIn: number;
  }>);
}
