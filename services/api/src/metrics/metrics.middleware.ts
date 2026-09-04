import { Injectable, NestMiddleware } from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import { MetricsService } from "./metrics.service";

/**
 * Middleware, NOT a NestJS interceptor — caught live: a `NestInterceptor`
 * only runs for requests that make it PAST every Guard (Nest's request
 * lifecycle is Middleware → Guards → Interceptors → Pipes → Handler), so
 * the first version of this (an interceptor) silently never recorded a
 * single 401 from JwtAuthGuard, 403 from PermissionsGuard, or 429 from
 * ThrottlerGuard — exactly the requests a metrics dashboard most needs
 * to show. Middleware runs before Guards, so nothing is missed.
 *
 * Still reads the final `response.statusCode` from Express's own
 * `finish` event (see metrics.interceptor.ts's — now deleted — comment
 * for why that specifically, not a synchronous read after `next()`,
 * matters for the error path).
 */
@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  constructor(private readonly metrics: MetricsService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime.bigint();

    res.once("finish", () => {
      // req.route is only populated once Express has matched a route —
      // a request rejected by CORS, a 404, or a guard that runs before
      // the router (none currently do, but this stays correct if one
      // ever does) still needs a label, so this falls back to the raw
      // path rather than leaving the metric unrecorded.
      const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : req.path;
      const labels = { method: req.method, route, status_code: String(res.statusCode) };
      const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
      this.metrics.httpRequestDuration.observe(labels, durationSeconds);
      this.metrics.httpRequestsTotal.inc(labels);
    });

    next();
  }
}
