import type { Request } from "express";

/** IP/user-agent captured for login attempts and audit log entries. */
export function requestContext(req: Request): { userAgent?: string; ipAddress?: string } {
  const userAgent = req.headers["user-agent"];
  return { userAgent, ipAddress: req.ip };
}
