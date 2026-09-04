/**
 * The staff login response (POST /auth/staff/login) is just a token pair
 * — no separate "staff profile" object (see services/api/src/auth/auth.service.ts
 * staffLogin(), which returns IssuedTokens only) — so this app reads the
 * staff's own id/email/permissions straight out of the access token's
 * payload rather than adding a round trip to a `/staff/me`-shaped
 * endpoint that doesn't exist. This is read-only, display-only decoding:
 * every request the app makes is still authorized server-side from the
 * token itself, regardless of what this client-side decode produces, so
 * a malformed or tampered value here can make the UI look wrong but
 * can't grant access to anything.
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
    const json = decodeBase64(padded);
    const payload = JSON.parse(json) as Partial<StaffTokenPayload>;
    if (!payload.sub || !payload.email || !Array.isArray(payload.permissions)) return null;
    return payload as StaffTokenPayload;
  } catch {
    return null;
  }
}

// Hermes (RN's default JS engine) doesn't guarantee a global atob/btoa,
// and this app has no other reason to pull in a base64 polyfill package
// — a JWT payload is short, so a small hand-rolled decoder is simpler
// than adding a dependency for one call site.
const BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function decodeBase64(input: string): string {
  let bytes = "";
  let buffer = 0;
  let bits = 0;
  for (const char of input) {
    if (char === "=") break;
    const value = BASE64_CHARS.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }
  return decodeURIComponent(
    bytes
      .split("")
      .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join(""),
  );
}
