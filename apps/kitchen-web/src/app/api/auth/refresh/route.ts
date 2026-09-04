import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { ApiResponse } from "@shri-anandam/shared-types";
import { API_URL, REFRESH_COOKIE_NAME, refreshCookieOptions } from "@/lib/server-config";

interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;

  if (!refreshToken) {
    return NextResponse.json({ success: false, error: { code: "UNAUTHORIZED", message: "No session", details: [] }, requestId: "" }, { status: 401 });
  }

  const upstream = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const json = (await upstream.json().catch(() => null)) as ApiResponse<IssuedTokens> | null;

  if (!upstream.ok || !json || !json.success) {
    cookieStore.delete({ name: REFRESH_COOKIE_NAME, path: "/api/auth" });
    return NextResponse.json(json ?? { success: false, error: { code: "UNAUTHORIZED", message: "Session expired", details: [] }, requestId: "" }, {
      status: upstream.status || 401,
    });
  }

  cookieStore.set(REFRESH_COOKIE_NAME, json.data.refreshToken, refreshCookieOptions(30 * 24 * 60 * 60));

  return NextResponse.json({ success: true, data: { accessToken: json.data.accessToken, expiresIn: json.data.expiresIn }, requestId: json.requestId } satisfies ApiResponse<{
    accessToken: string;
    expiresIn: number;
  }>);
}
