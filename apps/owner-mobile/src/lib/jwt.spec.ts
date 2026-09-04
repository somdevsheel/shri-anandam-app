import { decodeStaffToken } from "./jwt";

describe("decodeStaffToken", () => {
  // A synthetic (unsigned-payload-irrelevant, this decoder never checks
  // the signature — the server does that on every request) JWT with the
  // same shape services/api/src/auth/auth.service.ts staffLogin() issues.
  const SYNTHETIC_TOKEN =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzdGFmZi0xMjMiLCJzdWJqZWN0VHlwZSI6IlNUQUZGIiwiZW1haWwiOiJvd25lckBzaHJpYW5hbmRhbS5sb2NhbCIsInBlcm1pc3Npb25zIjpbIm9yZGVyLnJlYWQiLCJvcmRlci5hY2NlcHQiXSwiaWF0IjoxNzAwMDAwMDAwLCJleHAiOjE3MDAwMDM2MDB9.fakesignature";

  // Captured live from a real `POST /auth/staff/login` response during
  // Phase 8 verification (services/api running against real Postgres).
  const REAL_LOGIN_TOKEN =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI3OTRhOTI3ZC05ZTA1LTQyZTctYjM4OC1jNTA3MTk2YWE4NTEiLCJzdWJqZWN0VHlwZSI6IlNUQUZGIiwicGVybWlzc2lvbnMiOlsib3JkZXIucmVhZCIsIm9yZGVyLmNyZWF0ZSIsIm9yZGVyLmFjY2VwdCIsIm9yZGVyLnJlamVjdCIsIm9yZGVyLmNhbmNlbCIsIm9yZGVyLnJlZnVuZCIsInByb2R1Y3QucmVhZCIsInByb2R1Y3QuY3JlYXRlIiwicHJvZHVjdC51cGRhdGUiLCJwcm9kdWN0LmRlbGV0ZSIsImludmVudG9yeS5yZWFkIiwiaW52ZW50b3J5LmFkanVzdCIsInBheW1lbnQucmVhZCIsInBheW1lbnQuY29sbGVjdCIsInBheW1lbnQucmVmdW5kIiwic3RhZmYucmVhZCIsInN0YWZmLmNyZWF0ZSIsInN0YWZmLnVwZGF0ZSIsInN0YWZmLmRlbGV0ZSIsInJlcG9ydC5yZWFkIiwiYXVkaXQucmVhZCIsIm9yZ2FuaXphdGlvbi5yZWFkIiwib3JnYW5pemF0aW9uLnVwZGF0ZSIsImJyYW5jaC5yZWFkIiwiYnJhbmNoLmNyZWF0ZSIsImJyYW5jaC51cGRhdGUiLCJicmFuY2guZGVsZXRlIiwicm9sZS5tYW5hZ2UiXSwiZW1haWwiOiJvd25lckBzaHJpYW5hbmRhbS5sb2NhbCIsImlhdCI6MTc4ODUyNzg5MywiZXhwIjoxNzg4NTI4NzkzfQ.swgqIYNTQPC8hXmHFvmVFu7XjVV3nlMf0jYo0JSK_Dg";

  it("decodes a synthetic token's sub/email/permissions", () => {
    const payload = decodeStaffToken(SYNTHETIC_TOKEN);
    expect(payload).toEqual({
      sub: "staff-123",
      subjectType: "STAFF",
      email: "owner@shrianandam.local",
      permissions: ["order.read", "order.accept"],
      iat: 1700000000,
      exp: 1700003600,
    });
  });

  it("decodes a real access token issued by services/api's staff login", () => {
    const payload = decodeStaffToken(REAL_LOGIN_TOKEN);
    expect(payload?.sub).toBe("794a927d-9e05-42e7-b388-c507196aa851");
    expect(payload?.email).toBe("owner@shrianandam.local");
    expect(payload?.permissions).toContain("order.accept");
    expect(payload?.permissions).toContain("role.manage");
    expect(payload?.permissions.length).toBeGreaterThan(20);
  });

  it("returns null for garbage input rather than throwing", () => {
    expect(decodeStaffToken("not-a-jwt")).toBeNull();
    expect(decodeStaffToken("")).toBeNull();
    expect(decodeStaffToken("a.b")).toBeNull();
    expect(decodeStaffToken("a.notbase64!!!.c")).toBeNull();
  });

  it("returns null when required fields are missing from the payload", () => {
    // header.payload.sig where payload = {"foo":"bar"} base64url-encoded
    const incomplete = "eyJhbGciOiJIUzI1NiJ9.eyJmb28iOiJiYXIifQ.sig";
    expect(decodeStaffToken(incomplete)).toBeNull();
  });
});
