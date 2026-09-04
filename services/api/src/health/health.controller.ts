import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckError, HealthCheckService, HealthIndicatorResult } from "@nestjs/terminus";
import { PrismaService } from "../database/prisma.service";
import { RedisService } from "../redis/redis.service";
import { Public } from "../common/decorators/public.decorator";

/**
 * /health   — liveness + all dependencies (used for human/dashboard checks)
 * /live     — liveness only: is the process itself responsive? (k8s livenessProbe)
 * /ready    — readiness: can this instance actually serve traffic right
 *             now (DB + Redis reachable)? (k8s readinessProbe / LB health check)
 */
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get("live")
  live() {
    return { status: "ok" };
  }

  @Public()
  @Get("ready")
  @HealthCheck()
  ready() {
    return this.health.check([() => this.checkDatabase(), () => this.checkRedis()]);
  }

  @Public()
  @Get("health")
  @HealthCheck()
  full() {
    return this.health.check([() => this.checkDatabase(), () => this.checkRedis()]);
  }

  private async checkDatabase(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { database: { status: "up" } };
    } catch (err) {
      throw new HealthCheckError("Database check failed", { database: { status: "down", message: (err as Error).message } });
    }
  }

  private async checkRedis(): Promise<HealthIndicatorResult> {
    try {
      await this.redis.raw.ping();
      return { redis: { status: "up" } };
    } catch (err) {
      throw new HealthCheckError("Redis check failed", { redis: { status: "down", message: (err as Error).message } });
    }
  }
}
