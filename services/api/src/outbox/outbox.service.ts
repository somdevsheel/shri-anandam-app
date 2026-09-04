import { Injectable } from "@nestjs/common";
import type { DomainEvent } from "@shri-anandam/shared-types";
import type { Prisma } from "@prisma/client";
import type { PrismaTransactionClient } from "../database/prisma.service";

/**
 * Transactional Outbox Pattern (section 37). Domain services call
 * `append()` with the SAME Prisma transaction handle used to write the
 * business rows (e.g. Order + OrderItems + StockReservation), so the
 * event row commits atomically with the state change it describes. A
 * separate worker (services/notification-worker, added in Phase 8) polls
 * outbox_events for PENDING rows and publishes them to Redis Streams,
 * marking each PUBLISHED (or FAILED, for retry) — decoupling "did the
 * order commit" from "did the notification/queue publish succeed".
 */
@Injectable()
export class OutboxService {
  async append(
    tx: PrismaTransactionClient,
    event: {
      aggregateType: string;
      aggregateId: string;
      eventType: DomainEvent;
      payload: Record<string, unknown>;
    },
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        eventType: event.eventType,
        payload: event.payload as Prisma.InputJsonValue,
      },
    });
  }
}
