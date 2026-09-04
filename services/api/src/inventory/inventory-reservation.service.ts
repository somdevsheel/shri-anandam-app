import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import type { PrismaTransactionClient } from "../database/prisma.service";
import { OutboxService } from "../outbox/outbox.service";
import { DomainEvent } from "@shri-anandam/shared-types";
import { InsufficientStockError, NotFoundError } from "../common/errors/app.error";

export interface ReserveParams {
  branchId: string;
  productVariantId: string;
  quantity: number | Prisma.Decimal;
  orderId?: string;
  /** Default 15 minutes — long enough to complete checkout/payment, short enough that an abandoned cart releases quickly. */
  ttlMinutes?: number;
}

const DEFAULT_RESERVATION_TTL_MINUTES = 15;

/**
 * The load-bearing correctness engine for section 31: "Inventory must be
 * transaction-safe... two simultaneous orders [must not] consume stock
 * that does not exist." Every method that reads-then-writes stock takes
 * an explicit transaction handle and locks the InventoryItem row with
 * `SELECT ... FOR UPDATE` before computing availability, so a second
 * concurrent caller for the same item blocks on the lock (not a
 * check-then-act race) until the first transaction commits or rolls
 * back — see the concurrency integration test for proof this actually
 * holds under real simultaneous requests, not just in theory.
 *
 * Reservation-based, not decrement-on-checkout-start (section 30/31):
 * `stockQuantity` is only ever touched by `consume()` (an actual sale)
 * or by admin restock/adjust/wastage. A reservation only ever inserts a
 * StockReservation row; "available stock" is computed at read time as
 * `stockQuantity - SUM(active, non-expired reservations)`. This is what
 * lets an abandoned checkout release its hold (or simply expire) without
 * ever having mutated the committed stock figure.
 */
@Injectable()
export class InventoryReservationService {
  private readonly logger = new Logger(InventoryReservationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  /**
   * Locks the InventoryItem row, computes available stock, and inserts an
   * ACTIVE StockReservation if there's enough. Must be called with the
   * SAME transaction handle the caller uses for the rest of its write
   * (e.g. order creation in Phase 6) so the hold and the order commit or
   * roll back together — see reserveStandalone() for ad hoc/test use.
   */
  async reserve(tx: PrismaTransactionClient, params: ReserveParams): Promise<{ id: string }> {
    const quantity = new Prisma.Decimal(params.quantity);
    if (quantity.lessThanOrEqualTo(0)) {
      throw new InsufficientStockError("Reservation quantity must be positive");
    }

    // IDs are plain `text` columns (Prisma's default for `String @id
    // @default(uuid())`, not Postgres's native `uuid` type), so the
    // parameters compare directly — no `::uuid` cast, which would
    // otherwise fail with "operator does not exist: text = uuid".
    const locked = await tx.$queryRaw<{ id: string; stockQuantity: Prisma.Decimal }[]>`
      SELECT id, "stockQuantity" FROM inventory_items
      WHERE "branchId" = ${params.branchId} AND "productVariantId" = ${params.productVariantId}
      FOR UPDATE
    `;
    const item = locked[0];
    if (!item) {
      throw new NotFoundError("InventoryItem", `${params.branchId}/${params.productVariantId}`);
    }

    const activeReserved = await tx.stockReservation.aggregate({
      where: { inventoryItemId: item.id, status: "ACTIVE", expiresAt: { gt: new Date() } },
      _sum: { quantity: true },
    });
    const alreadyReserved = activeReserved._sum.quantity ?? new Prisma.Decimal(0);
    const available = new Prisma.Decimal(item.stockQuantity).minus(alreadyReserved);

    if (available.lessThan(quantity)) {
      throw new InsufficientStockError(
        `Requested ${quantity.toString()} but only ${available.toString()} available`,
      );
    }

    const ttlMinutes = params.ttlMinutes ?? DEFAULT_RESERVATION_TTL_MINUTES;
    const reservation = await tx.stockReservation.create({
      data: {
        inventoryItemId: item.id,
        orderId: params.orderId,
        quantity,
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + ttlMinutes * 60_000),
      },
    });

    return { id: reservation.id };
  }

  /** Convenience wrapper for callers outside a larger transaction (admin tools, tests). */
  async reserveStandalone(params: ReserveParams): Promise<{ id: string }> {
    return this.prisma.$transaction((tx) => this.reserve(tx, params));
  }

  /** Releases a hold without ever touching committed stock — used when an order is abandoned/cancelled before payment. Idempotent. */
  async release(tx: PrismaTransactionClient, reservationId: string): Promise<void> {
    await tx.stockReservation.updateMany({
      where: { id: reservationId, status: "ACTIVE" },
      data: { status: "RELEASED" },
    });
  }

  /**
   * Converts a hold into an actual sale: marks the reservation CONSUMED
   * and writes the InventoryTransaction(SALE) that finally decrements
   * `stockQuantity` — the only place a sale actually reduces stock.
   */
  async consume(tx: PrismaTransactionClient, reservationId: string, referenceOrderId?: string): Promise<void> {
    const reservation = await tx.stockReservation.findUnique({ where: { id: reservationId } });
    if (!reservation || reservation.status !== "ACTIVE") {
      throw new NotFoundError("Active StockReservation", reservationId);
    }

    await tx.stockReservation.update({ where: { id: reservationId }, data: { status: "CONSUMED" } });

    const item = await tx.inventoryItem.update({
      where: { id: reservation.inventoryItemId },
      data: { stockQuantity: { decrement: reservation.quantity } },
    });

    await tx.inventoryTransaction.create({
      data: {
        inventoryItemId: item.id,
        type: "SALE",
        quantityDelta: reservation.quantity.negated(),
        referenceOrderId: referenceOrderId ?? reservation.orderId,
      },
    });

    await this.maybeFlagLowStock(tx, item.id, item.stockQuantity);
  }

  /**
   * Scheduled sweep (every minute) that marks past-due ACTIVE reservations
   * EXPIRED. Not the sole source of correctness — reserve() already
   * excludes expired-but-not-yet-swept rows from its availability
   * calculation via `expiresAt: { gt: now }` — this just keeps the
   * `stock_reservations` table's status column accurate for admin
   * visibility and reporting, and is safe to run concurrently with
   * itself (a plain conditional UPDATE, not a read-then-write race).
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async expireStaleReservations(): Promise<void> {
    const result = await this.prisma.stockReservation.updateMany({
      where: { status: "ACTIVE", expiresAt: { lt: new Date() } },
      data: { status: "EXPIRED" },
    });
    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} stale stock reservation(s)`);
    }
  }

  /** Writes an InventoryLow outbox event (section 38) when a stock-decreasing operation crosses the low-stock threshold. */
  async maybeFlagLowStock(tx: PrismaTransactionClient, inventoryItemId: string, newQuantity: Prisma.Decimal): Promise<void> {
    const item = await tx.inventoryItem.findUnique({ where: { id: inventoryItemId } });
    if (!item) return;
    if (newQuantity.lessThanOrEqualTo(item.lowStockThreshold)) {
      await this.outbox.append(tx, {
        aggregateType: "InventoryItem",
        aggregateId: item.id,
        eventType: DomainEvent.INVENTORY_LOW,
        payload: { branchId: item.branchId, productVariantId: item.productVariantId, stockQuantity: newQuantity.toString() },
      });
    }
  }
}
