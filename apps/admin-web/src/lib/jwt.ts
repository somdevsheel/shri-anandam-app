/**
 * Same rationale as apps/owner-mobile/src/lib/jwt.ts: the staff login
 * response (proxied through /api/auth/login) is a token pair only — see
 * services/api/src/auth/auth.service.ts staffLogin() — so this app reads
 * its own identity/permissions from the access token's payload rather
 * than a `/staff/me`-shaped endpoint that doesn't exist. Purely
 * display/UI-gating; the server re-checks every permission on every
 * request regardless of what this decode produces.
 *
 * Unlike the RN app, this runs in both a Node.js runtime (Route
 * Handlers) and the browser — both provide a global `atob`, so no
 * hand-rolled base64 decoder is needed here.
 */
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
