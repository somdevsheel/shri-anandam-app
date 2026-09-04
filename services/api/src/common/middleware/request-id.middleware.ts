import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";

export interface RequestWithId extends Request {
  requestId: string;
}

/**
 * Assigns a request ID to every inbound request (reusing an inbound
 * `X-Request-Id` from a trusted upstream proxy when present) so it can be
 * threaded through logs, error responses, and traces end-to-end.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: RequestWithId, res: Response, next: NextFunction): void {
    const incoming = req.headers["x-request-id"];
    req.requestId = typeof incoming === "string" && incoming.length > 0 ? incoming : randomUUID();
    res.setHeader("X-Request-Id", req.requestId);
    next();
  }
}
