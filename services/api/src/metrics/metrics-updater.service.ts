import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../database/prisma.service";
import { MetricsService } from "./metrics.service";

/** Gauges reflect a live count, not an event — polled on the same cron cadence InventoryReservationService already uses for its own expiry sweep, not driven by request traffic. */
@Injectable()
export class MetricsUpdaterService {
  private readonly logger = new Logger(MetricsUpdaterService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async refresh(): Promise<void> {
    try {
      const [pendingOutboxEvents, activeReservations] = await Promise.all([
        this.prisma.outboxEvent.count({ where: { status: "PENDING" } }),
        this.prisma.stockReservation.count({ where: { status: "ACTIVE", expiresAt: { gt: new Date() } } }),
      ]);
      this.metrics.outboxBacklog.set(pendingOutboxEvents);
      this.metrics.activeStockReservations.set(activeReservations);
    } catch (err) {
      // A failed metrics refresh must never affect request handling —
      // log and let the next tick retry, same principle as every other
      // background job in this codebase.
      this.logger.warn(`Failed to refresh gauges: ${err instanceof Error ? err.message : err}`);
    }
  }
}
