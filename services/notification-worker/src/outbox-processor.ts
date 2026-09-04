import { DomainEvent, Permission } from "@shri-anandam/shared-types";
import type { NotificationDb, OutboxEventRow } from "./db";
import type { NotificationProvider, PushNotification } from "./providers/notification-provider.interface";
import { lowStockNotification, newOrderNotification, orderStatusNotification, paymentNotification } from "./notification-templates";
import type { Logger } from "./logger";

const ORDER_STATUS_EVENTS = new Set<string>([
  DomainEvent.ORDER_ACCEPTED,
  DomainEvent.ORDER_PREPARING,
  DomainEvent.ORDER_READY,
  DomainEvent.ORDER_OUT_FOR_DELIVERY,
  DomainEvent.ORDER_DELIVERED,
  DomainEvent.ORDER_CANCELLED,
  DomainEvent.ORDER_REJECTED,
]);

/**
 * The outbox -> FCM pipeline (section 21). One event is fully handled —
 * every target device notified, every Notification row written, the
 * OutboxEvent itself marked PUBLISHED/PENDING(retry)/FAILED — before
 * moving to the next; a single event never blocks the batch (errors are
 * caught per-event, not left to crash the poll loop).
 */
export class OutboxProcessor {
  constructor(
    private readonly db: NotificationDb,
    private readonly provider: NotificationProvider,
    private readonly logger: Logger,
  ) {}

  async processBatch(batchSize: number): Promise<number> {
    const events = await this.db.claimPendingEvents(batchSize);
    for (const event of events) {
      await this.processOne(event);
    }
    return events.length;
  }

  private async processOne(event: OutboxEventRow): Promise<void> {
    try {
      const targets = await this.resolveTargets(event);
      if (targets.length === 0) {
        // Nothing to notify (e.g. no owner device registered yet, or a
        // customer with no app installed) — this is a normal, expected
        // outcome, not a failure. Section 21: the order/payment DB state
        // is already correct regardless of whether anyone gets pinged.
        await this.db.markPublished(event.id);
        return;
      }

      let anyRetryable = false;
      for (const target of targets) {
        const notificationId = await this.db.insertNotification({
          outboxEventId: event.id,
          customerId: target.customerId,
          staffId: target.staffId,
          deviceId: target.deviceId,
          type: event.eventType,
          title: target.notification.title,
          body: target.notification.body,
          entityType: target.notification.data.entityType,
          entityId: target.notification.data.orderId ?? target.notification.data.inventoryItemId,
        });

        const result = await this.provider.send(target.fcmToken, target.notification);
        if (result.status === "sent") {
          await this.db.markNotificationSent(notificationId);
        } else {
          await this.db.markNotificationFailed(notificationId);
          if (result.deactivateToken) {
            await this.db.deactivateDeviceToken(target.deviceId);
            this.logger.info({ deviceId: target.deviceId }, "Deactivated an invalid/unregistered device token");
          }
          if (result.retryable) anyRetryable = true;
        }
      }

      if (anyRetryable) {
        await this.db.markFailed(event.id, event.retryCount);
      } else {
        await this.db.markPublished(event.id);
      }
    } catch (err) {
      this.logger.error({ err, eventId: event.id, eventType: event.eventType }, "Failed to process outbox event");
      await this.db.markFailed(event.id, event.retryCount).catch((markErr) =>
        this.logger.error({ err: markErr, eventId: event.id }, "Failed to even mark the event as failed — will be retried by the same PENDING row on the next poll"),
      );
    }
  }

  private async resolveTargets(
    event: OutboxEventRow,
  ): Promise<{ fcmToken: string; deviceId: string; customerId?: string; staffId?: string; notification: PushNotification }[]> {
    if (event.eventType === DomainEvent.ORDER_CREATED) {
      return this.resolveNewOrderTargets(event);
    }
    if (ORDER_STATUS_EVENTS.has(event.eventType)) {
      return this.resolveOrderStatusTargets(event);
    }
    if (event.eventType === DomainEvent.PAYMENT_SUCCEEDED || event.eventType === DomainEvent.PAYMENT_FAILED) {
      return this.resolvePaymentTargets(event);
    }
    if (event.eventType === DomainEvent.INVENTORY_LOW) {
      return this.resolveLowStockTargets(event);
    }
    // Unrecognized event type — not an error (new event types get added
    // as later phases wire up more of section 38's list); just nothing
    // for this worker to do with it yet.
    return [];
  }

  private async resolveNewOrderTargets(event: OutboxEventRow) {
    const orderId = event.aggregateId;
    const orderNumber = event.payload.orderNumber as string | undefined;
    const totalInPaise = event.payload.totalInPaise as number | undefined;
    const itemCount = event.payload.itemCount as number | undefined;
    if (!orderNumber || totalInPaise === undefined || itemCount === undefined) return [];

    const notification = newOrderNotification(orderId, orderNumber, totalInPaise, itemCount);
    const devices = await this.db.getOwnerDeviceTokens(Permission.ORDER_ACCEPT);
    return devices.map((d) => ({ fcmToken: d.fcmToken, deviceId: d.id, staffId: d.staffId, notification }));
  }

  private async resolveOrderStatusTargets(event: OutboxEventRow) {
    const order = await this.db.getOrderSummary(event.aggregateId);
    if (!order) return [];

    const notification = orderStatusNotification(event.eventType, event.aggregateId, order.orderNumber);
    if (!notification) return [];

    const devices = await this.db.getCustomerDeviceTokens(order.customerId);
    return devices.map((d) => ({ fcmToken: d.fcmToken, deviceId: d.id, customerId: order.customerId, notification }));
  }

  private async resolvePaymentTargets(event: OutboxEventRow) {
    const orderId = event.payload.orderId as string | undefined;
    if (!orderId) return [];
    const order = await this.db.getOrderSummary(orderId);
    if (!order) return [];

    const notification = paymentNotification(
      event.eventType as "PaymentSucceeded" | "PaymentFailed",
      orderId,
      order.orderNumber,
    );
    const devices = await this.db.getCustomerDeviceTokens(order.customerId);
    return devices.map((d) => ({ fcmToken: d.fcmToken, deviceId: d.id, customerId: order.customerId, notification }));
  }

  private async resolveLowStockTargets(event: OutboxEventRow) {
    const productVariantId = event.payload.productVariantId as string | undefined;
    const productName = productVariantId ? await this.db.getProductNameByVariantId(productVariantId) : null;
    const notification = lowStockNotification(event.aggregateId, productName ?? "A product");

    const devices = await this.db.getOwnerDeviceTokens(Permission.INVENTORY_ADJUST);
    return devices.map((d) => ({ fcmToken: d.fcmToken, deviceId: d.id, staffId: d.staffId, notification }));
  }
}
