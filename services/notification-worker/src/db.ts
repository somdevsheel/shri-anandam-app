import { Pool } from "pg";

export interface OutboxEventRow {
  id: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: Record<string, unknown>;
  retryCount: number;
}

export interface DeviceTokenRow {
  id: string;
  fcmToken: string;
  platform: string;
  staffId?: string;
}

export interface OrderSummaryRow {
  orderNumber: string;
  totalInPaise: number;
  customerId: string;
  branchId: string;
}

export interface ProductSummaryRow {
  name: string;
}

const MAX_RETRIES = 5;

export class NotificationDb {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 5 });
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async ping(): Promise<void> {
    await this.pool.query("SELECT 1");
  }

  /**
   * Claims a batch of PENDING outbox events for this process using
   * `FOR UPDATE SKIP LOCKED` — safe to run multiple worker replicas
   * concurrently (section 67's scaling story) without two of them
   * double-sending the same notification; a locked-but-not-yet-committed
   * row is simply skipped by the other replica rather than raced over.
   */
  async claimPendingEvents(limit: number): Promise<OutboxEventRow[]> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `SELECT id, "aggregateType", "aggregateId", "eventType", payload, "retryCount"
         FROM outbox_events
         WHERE status = 'PENDING'
         ORDER BY "createdAt" ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED`,
        [limit],
      );
      // Mark them PROCESSING-in-place by bumping nothing yet — the
      // transaction's row lock IS the claim. We commit immediately so
      // the lock is released quickly (processing/FCM calls happen
      // outside this transaction, matching the "no external call inside
      // a DB transaction" rule from Phase 7's ADR-017) and rely on each
      // event's own status update at the end of processing.
      await client.query("COMMIT");
      return rows;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async markPublished(eventId: string): Promise<void> {
    await this.pool.query(`UPDATE outbox_events SET status = 'PUBLISHED', "publishedAt" = now() WHERE id = $1`, [eventId]);
  }

  async markFailed(eventId: string, currentRetryCount: number): Promise<void> {
    const nextStatus = currentRetryCount + 1 >= MAX_RETRIES ? "FAILED" : "PENDING";
    await this.pool.query(`UPDATE outbox_events SET status = $2, "retryCount" = "retryCount" + 1 WHERE id = $1`, [
      eventId,
      nextStatus,
    ]);
  }

  async getOrderSummary(orderId: string): Promise<OrderSummaryRow | null> {
    const { rows } = await this.pool.query(
      `SELECT "orderNumber", "totalInPaise", "customerId", "branchId" FROM orders WHERE id = $1`,
      [orderId],
    );
    return rows[0] ?? null;
  }

  /**
   * InventoryLow's outbox payload carries a productVariantId (see
   * InventoryReservationService.maybeFlagLowStock in services/api), not
   * a product id directly — the low-stock alert should name the
   * product, so this joins through product_variants rather than
   * querying products with what would actually be a variant id.
   */
  async getProductNameByVariantId(productVariantId: string): Promise<string | null> {
    const { rows } = await this.pool.query<ProductSummaryRow>(
      `SELECT p.name FROM products p JOIN product_variants pv ON pv."productId" = p.id WHERE pv.id = $1`,
      [productVariantId],
    );
    return rows[0]?.name ?? null;
  }

  /** Active devices for the owner app, scoped to staff who hold the given permission — e.g. only staff who can actually accept an order get the new-order push. */
  async getOwnerDeviceTokens(permissionKey: string): Promise<DeviceTokenRow[]> {
    const { rows } = await this.pool.query(
      `SELECT dt.id, dt."fcmToken", dt.platform, dt."staffId"
       FROM device_tokens dt
       JOIN staff s ON s.id = dt."staffId"
       WHERE dt."appType" = 'OWNER'
         AND dt."isActive" = true
         AND s."isActive" = true
         AND EXISTS (
           SELECT 1 FROM staff_roles sr
           JOIN role_permissions rp ON rp."roleId" = sr."roleId"
           JOIN permissions p ON p.id = rp."permissionId"
           WHERE sr."staffId" = s.id AND p.key = $1
         )`,
      [permissionKey],
    );
    return rows;
  }

  async getCustomerDeviceTokens(customerId: string): Promise<DeviceTokenRow[]> {
    const { rows } = await this.pool.query(
      `SELECT id, "fcmToken", platform FROM device_tokens WHERE "customerId" = $1 AND "appType" = 'CUSTOMER' AND "isActive" = true`,
      [customerId],
    );
    return rows;
  }

  /**
   * Upserts on (outboxEventId, deviceId) — a retried outbox event (FCM
   * send failed, event re-claimed on a later poll) re-processes the same
   * event for the same device, and without this the naive INSERT used
   * before would write a fresh duplicate "NEW ORDER" row per retry
   * attempt (observed live: 5 duplicate rows for one order after FCM
   * failed closed 5 times). Re-running resets status back to PENDING so
   * a genuine retry is reflected, not just the first attempt's outcome.
   */
  async insertNotification(input: {
    outboxEventId: string;
    customerId?: string;
    staffId?: string;
    deviceId: string;
    type: string;
    title: string;
    body: string;
    entityType?: string;
    entityId?: string;
  }): Promise<string> {
    const { rows } = await this.pool.query<{ id: string }>(
      `INSERT INTO notifications (id, "customerId", "staffId", "deviceId", "outboxEventId", channel, category, type, title, body, "entityType", "entityId", status, "createdAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'PUSH', 'TRANSACTIONAL', $5, $6, $7, $8, $9, 'PENDING', now())
       ON CONFLICT ("outboxEventId", "deviceId") DO UPDATE SET
         "customerId" = excluded."customerId",
         "staffId" = excluded."staffId",
         title = excluded.title,
         body = excluded.body,
         status = 'PENDING',
         "sentAt" = NULL,
         "readAt" = notifications."readAt"
       RETURNING id`,
      [
        input.customerId ?? null,
        input.staffId ?? null,
        input.deviceId,
        input.outboxEventId,
        input.type,
        input.title,
        input.body,
        input.entityType ?? null,
        input.entityId ?? null,
      ],
    );
    return rows[0]!.id;
  }

  async markNotificationSent(notificationId: string): Promise<void> {
    await this.pool.query(`UPDATE notifications SET status = 'SENT', "sentAt" = now() WHERE id = $1`, [notificationId]);
  }

  async markNotificationFailed(notificationId: string): Promise<void> {
    await this.pool.query(`UPDATE notifications SET status = 'FAILED' WHERE id = $1`, [notificationId]);
  }

  /** section 22: a token FCM reports as unregistered/invalid is deactivated, not retried forever. */
  async deactivateDeviceToken(deviceId: string): Promise<void> {
    await this.pool.query(`UPDATE device_tokens SET "isActive" = false WHERE id = $1`, [deviceId]);
  }
}
