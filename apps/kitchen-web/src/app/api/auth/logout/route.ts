import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { API_URL, REFRESH_COOKIE_NAME } from "@/lib/server-config";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE_NAME)?.value;

  if (refreshToken) {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => undefined);
  }

  cookieStore.delete({ name: REFRESH_COOKIE_NAME, path: "/api/auth" });
  return NextResponse.json({ success: true, data: { message: "Logged out" }, requestId: "" });
}
