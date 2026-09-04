import { Controller, Get, Header } from "@nestjs/common";
import { Public } from "../common/decorators/public.decorator";
import { RawResponse } from "../common/decorators/raw-response.decorator";
import { MetricsService } from "./metrics.service";

/**
 * `@Public()` (no JWT) the same way /health, /live, /ready are — a
 * Prometheus scraper has no JWT to present. This is NOT the same as
 * "safe to expose to the internet": like the health endpoints, this is
 * meant to sit behind the same private-network restriction
 * docs/architecture/production-architecture.md's "Private networking"
 * section already documents for Postgres/Redis (a security-group rule
 * allowing the scraper's subnet only), not additional application-layer
 * auth — Prometheus's own scrape model has no token to send either.
 */
@Controller("metrics")
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @RawResponse()
  @Get()
  @Header("Content-Type", "text/plain")
  async getMetrics(): Promise<string> {
    return this.metrics.registry.metrics();
  }
}
