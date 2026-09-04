/** Identical to apps/admin-web/src/lib/jwt.ts — see its comment for why this decodes the access token itself rather than calling a `/staff/me`-shaped endpoint that doesn't exist. */
export interface StaffTokenPayload {
  sub: string;
  subjectType: "STAFF";
  email: string;
  permissions: string[];
  exp: number;
}

export function decodeStaffToken(accessToken: string): StaffTokenPayload | null {
  try {
    const [, payloadSegment] = accessToken.split(".");
    if (!payloadSegment) return null;
    const base64 = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
    const payload = JSON.parse(json) as Partial<StaffTokenPayload>;
    if (!payload.sub || !payload.email || !Array.isArray(payload.permissions)) return null;
    return payload as StaffTokenPayload;
  } catch {
    return null;
  }
}
