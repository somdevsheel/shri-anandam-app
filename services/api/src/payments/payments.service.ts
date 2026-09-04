import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { DomainEvent, ErrorCode, Permission } from "@shri-anandam/shared-types";
import { HttpStatus } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { PrismaTransactionClient } from "../database/prisma.service";
import { AuditLogService } from "../audit/audit-log.service";
import { OutboxService } from "../outbox/outbox.service";
import { InventoryReservationService } from "../inventory/inventory-reservation.service";
import { PAYMENT_PROVIDER, type PaymentProvider } from "./providers/payment-provider.interface";
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../common/errors/app.error";
import type { AuthenticatedStaff } from "../auth/types/authenticated-user.type";
import type { AddManualPaymentDto, CollectPaymentDto, CreateRefundDto, ReconciliationQueryDto } from "@shri-anandam/validation";

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Section 12-18: the payment domain. Deliberately depends only on the
 * PaymentProvider interface (injected via the PAYMENT_PROVIDER token —
 * PaymentsModule binds it to RazorpayPaymentProvider), never on
 * Razorpay's SDK/types directly, so a second gateway is a new provider
 * class + a module binding change, not a rewrite here.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly outbox: OutboxService,
    private readonly reservations: InventoryReservationService,
    @Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProvider,
  ) {}

  // ---------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------

  async listForOrder(orderId: string, actor: { subjectType: "CUSTOMER" | "STAFF"; id: string; permissions?: Permission[] }) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { id: true, customerId: true } });
    if (!order) throw new NotFoundError("Order", orderId);
    if (actor.subjectType === "CUSTOMER" && order.customerId !== actor.id) throw new NotFoundError("Order", orderId);
    if (actor.subjectType === "STAFF" && !actor.permissions?.includes(Permission.PAYMENT_READ)) {
      throw new ForbiddenError("Missing required permission: payment.read");
    }

    return this.prisma.payment.findMany({
      where: { orderId },
      include: { transactions: true, refunds: true },
      orderBy: { createdAt: "asc" },
    });
  }

  // ---------------------------------------------------------------------
  // Online payment initiation (called right after checkout, and as a
  // customer-facing retry if the inline attempt failed)
  // ---------------------------------------------------------------------

  async initiatePayment(customerId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { order: true } });
    if (!payment) throw new NotFoundError("Payment", paymentId);
    if (payment.order.customerId !== customerId) {
      // Same not-found-not-forbidden rationale as everywhere else a
      // customer could probe another customer's id (Orders, Cart,
      // Addresses) — see e.g. customers.service.ts.
      throw new NotFoundError("Payment", paymentId);
    }
    if (payment.provider !== "RAZORPAY") {
      throw new ValidationError("This payment does not use an online gateway");
    }
    if (payment.status !== "PENDING") {
      throw new ConflictError(`Payment is already ${payment.status}`);
    }

    try {
      const result = await this.provider.createProviderOrder(payment.amountInPaise, payment.order.orderNumber);
      return this.prisma.payment.update({ where: { id: paymentId }, data: { providerOrderId: result.providerOrderId } });
    } catch (err) {
      this.logger.error(`Failed to initiate online payment for order ${payment.order.orderNumber}: ${err instanceof Error ? err.message : err}`);
      throw err;
    }
  }

  // ---------------------------------------------------------------------
  // Offline collection (section 15) and split/partial payments (section 16)
  // ---------------------------------------------------------------------

  async collect(staff: AuthenticatedStaff, paymentId: string, dto: CollectPaymentDto, ctx: RequestContext) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundError("Payment", paymentId);
    if (payment.provider === "RAZORPAY") {
      throw new ValidationError("Online payments are confirmed by the gateway webhook, not manually collected");
    }
    if (payment.status === "PAID") {
      throw new ConflictError("This payment has already been collected");
    }

    const amountInPaise = dto.amountInPaise ?? payment.amountInPaise;

    return this.prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: paymentId }, data: { status: "PAID" } });
      await tx.paymentTransaction.create({
        data: {
          paymentId,
          type: "MANUAL_COLLECTION",
          amountInPaise,
          collectedByStaffId: staff.id,
          referenceNumber: dto.referenceNumber,
          notes: dto.notes,
        },
      });

      await this.auditLog.record(
        {
          actor: { subjectType: "STAFF", id: staff.id },
          action: "PAYMENT_COLLECTED",
          entityType: "Payment",
          entityId: paymentId,
          newValue: { amountInPaise, method: payment.method, referenceNumber: dto.referenceNumber },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      await this.outbox.append(tx, {
        aggregateType: "Payment",
        aggregateId: paymentId,
        eventType: DomainEvent.PAYMENT_SUCCEEDED,
        payload: { paymentId, orderId: payment.orderId, amountInPaise },
      });

      await this.recomputeOrderPaymentStatus(tx, payment.orderId);

      return tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { transactions: true } });
    });
  }

  /** Adds a NEW payment (a different method/amount) to an order that already has one — split/partial payments, section 16. */
  async addManualPayment(staff: AuthenticatedStaff, orderId: string, dto: AddManualPaymentDto, ctx: RequestContext) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: { payments: true } });
    if (!order) throw new NotFoundError("Order", orderId);

    const alreadyPaid = order.payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.amountInPaise, 0);
    const remaining = order.totalInPaise - alreadyPaid;
    if (dto.amountInPaise > remaining) {
      throw new ValidationError(`Amount exceeds the remaining balance of ₹${(remaining / 100).toFixed(2)}`, [
        { field: "amountInPaise", message: `Remaining balance is ${remaining} paise` },
      ]);
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: { orderId, provider: "MANUAL", method: dto.method, status: "PAID", amountInPaise: dto.amountInPaise },
      });
      await tx.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          type: "MANUAL_COLLECTION",
          amountInPaise: dto.amountInPaise,
          collectedByStaffId: staff.id,
          referenceNumber: dto.referenceNumber,
          notes: dto.notes,
        },
      });

      await this.auditLog.record(
        {
          actor: { subjectType: "STAFF", id: staff.id },
          action: "PAYMENT_SPLIT_ADDED",
          entityType: "Order",
          entityId: orderId,
          newValue: { method: dto.method, amountInPaise: dto.amountInPaise },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      await this.recomputeOrderPaymentStatus(tx, orderId);

      return tx.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { transactions: true } });
    });
  }

  // ---------------------------------------------------------------------
  // Webhooks (section 13: signature-verified, idempotent, logged, audited, retry-safe)
  // ---------------------------------------------------------------------

  async handleWebhook(rawBody: Buffer, signatureHeader: string | undefined): Promise<{ status: "processed" | "duplicate" | "ignored" }> {
    const signatureVerified = this.provider.verifyWebhookSignature(rawBody, signatureHeader);
    if (!signatureVerified) {
      // Logged, not silently dropped — an invalid signature is either an
      // attacker or a misconfigured secret, both worth knowing about.
      this.logger.warn("Rejected a payment webhook with an invalid signature");
      throw new AppError(ErrorCode.UNAUTHORIZED, "Invalid webhook signature", HttpStatus.UNAUTHORIZED);
    }

    const event = this.provider.parseWebhookEvent(rawBody);

    // The unique (provider, eventId) constraint is the real idempotency
    // guard — this insert either succeeds (first delivery) or throws
    // P2002 (a retry/redelivery of one we already handled), which is
    // treated as a normal, expected outcome, not an error.
    try {
      await this.prisma.paymentWebhookEvent.create({
        data: { provider: "RAZORPAY", eventId: event.eventId, signatureVerified, rawPayload: rawBody.toString("utf8") },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        this.logger.log(`Ignoring duplicate webhook delivery: ${event.eventId}`);
        return { status: "duplicate" };
      }
      throw err;
    }

    if (event.status !== "captured" && event.status !== "failed") {
      await this.prisma.paymentWebhookEvent.update({
        where: { provider_eventId: { provider: "RAZORPAY", eventId: event.eventId } },
        data: { processedAt: new Date() },
      });
      return { status: "ignored" };
    }

    const payment = event.providerOrderId
      ? await this.prisma.payment.findFirst({ where: { providerOrderId: event.providerOrderId } })
      : null;
    if (!payment) {
      this.logger.warn(`Webhook ${event.eventId} references unknown providerOrderId ${event.providerOrderId}`);
      await this.prisma.paymentWebhookEvent.update({
        where: { provider_eventId: { provider: "RAZORPAY", eventId: event.eventId } },
        data: { processedAt: new Date() },
      });
      return { status: "ignored" };
    }

    await this.prisma.$transaction(async (tx) => {
      if (event.status === "captured") {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: "PAID", providerPaymentId: event.providerPaymentId },
        });
        await tx.paymentTransaction.create({
          data: { paymentId: payment.id, type: "CAPTURE", amountInPaise: event.amountInPaise ?? payment.amountInPaise },
        });

        // Convert the hold placed at checkout into an actual sale, now
        // that the gateway has confirmed money changed hands — see
        // ADR-015/017. Untouched for offline payments, which already
        // consumed at order-creation time.
        const activeReservations = await tx.stockReservation.findMany({
          where: { orderId: payment.orderId, status: "ACTIVE" },
        });
        for (const reservation of activeReservations) {
          await this.reservations.consume(tx, reservation.id, payment.orderId);
        }

        await this.outbox.append(tx, {
          aggregateType: "Payment",
          aggregateId: payment.id,
          eventType: DomainEvent.PAYMENT_SUCCEEDED,
          payload: { paymentId: payment.id, orderId: payment.orderId },
        });
      } else {
        await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED" } });

        // Release the hold — this payment attempt failed, the stock was
        // never actually sold. The customer can retry payment (a new
        // Payment row) or abandon the order.
        const activeReservations = await tx.stockReservation.findMany({
          where: { orderId: payment.orderId, status: "ACTIVE" },
        });
        for (const reservation of activeReservations) {
          await this.reservations.release(tx, reservation.id);
        }

        await this.outbox.append(tx, {
          aggregateType: "Payment",
          aggregateId: payment.id,
          eventType: DomainEvent.PAYMENT_FAILED,
          payload: { paymentId: payment.id, orderId: payment.orderId },
        });
      }

      await this.recomputeOrderPaymentStatus(tx, payment.orderId);

      await tx.paymentWebhookEvent.update({
        where: { provider_eventId: { provider: "RAZORPAY", eventId: event.eventId } },
        data: { processedAt: new Date() },
      });
    });

    return { status: "processed" };
  }

  // ---------------------------------------------------------------------
  // Refunds (section 17)
  // ---------------------------------------------------------------------

  async createRefund(staff: AuthenticatedStaff, paymentId: string, dto: CreateRefundDto, ctx: RequestContext) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId }, include: { refunds: true } });
    if (!payment) throw new NotFoundError("Payment", paymentId);
    if (payment.status !== "PAID" && payment.status !== "PARTIALLY_REFUNDED" && payment.status !== "REFUND_PENDING") {
      throw new ConflictError(`Cannot refund a payment with status ${payment.status}`);
    }

    const alreadyRefunded = payment.refunds
      .filter((r) => r.status === "SUCCESS")
      .reduce((sum, r) => sum + r.amountInPaise, 0);
    const refundable = payment.amountInPaise - alreadyRefunded;
    if (dto.amountInPaise > refundable) {
      throw new ValidationError(`Refund amount exceeds the refundable balance of ₹${(refundable / 100).toFixed(2)}`, [
        { field: "amountInPaise", message: `Refundable balance is ${refundable} paise` },
      ]);
    }

    const refund = await this.prisma.refund.create({
      data: { paymentId, amountInPaise: dto.amountInPaise, reason: dto.reason, initiatedByStaffId: staff.id, status: "PENDING" },
    });

    let status: "SUCCESS" | "FAILED" = "SUCCESS";
    let providerRefundReference: string | undefined;

    if (payment.provider === "RAZORPAY") {
      if (!payment.providerPaymentId) {
        status = "FAILED";
      } else {
        try {
          const result = await this.provider.createRefund(payment.providerPaymentId, dto.amountInPaise);
          providerRefundReference = result.providerRefundId;
        } catch (err) {
          this.logger.error(`Refund failed at the gateway for payment ${paymentId}: ${err instanceof Error ? err.message : err}`);
          status = "FAILED";
        }
      }
    }
    // MANUAL payments (COD/Pay-at-Store) have no gateway call — the
    // refund itself (cash handed back, bank transfer arranged) happens
    // outside this system; recording it as SUCCESS here is recording
    // that staff have done so, matching section 15's manual-collection
    // pattern applied to the reverse direction.

    return this.prisma.$transaction(async (tx) => {
      const updatedRefund = await tx.refund.update({
        where: { id: refund.id },
        data: { status, providerRefundReference },
      });

      if (status === "SUCCESS") {
        await tx.paymentTransaction.create({
          data: { paymentId, type: "REFUND", amountInPaise: -dto.amountInPaise, collectedByStaffId: staff.id, notes: dto.reason },
        });
      }

      // section 45: refunds are an explicitly audited sensitive action.
      await this.auditLog.record(
        {
          actor: { subjectType: "STAFF", id: staff.id },
          action: "REFUND_" + status,
          entityType: "Refund",
          entityId: refund.id,
          newValue: { paymentId, amountInPaise: dto.amountInPaise, reason: dto.reason, status },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      if (status === "SUCCESS") {
        await this.outbox.append(tx, {
          aggregateType: "Refund",
          aggregateId: refund.id,
          eventType: DomainEvent.REFUND_COMPLETED,
          payload: { refundId: refund.id, paymentId, amountInPaise: dto.amountInPaise },
        });
        await this.recomputeOrderPaymentStatus(tx, payment.orderId);
      }

      if (status === "FAILED") {
        throw new AppError(
          ErrorCode.INTERNAL_ERROR,
          "Refund could not be completed — see the Refund record for details",
          HttpStatus.BAD_GATEWAY,
        );
      }

      return updatedRefund;
    });
  }

  // ---------------------------------------------------------------------
  // Reconciliation (section 18)
  // ---------------------------------------------------------------------

  async getReconciliation(query: ReconciliationQueryDto) {
    const where: Prisma.PaymentWhereInput = {
      status: "PAID",
      createdAt: { gte: query.dateFrom, lte: query.dateTo },
      order: query.branchId ? { branchId: query.branchId } : undefined,
    };

    const payments = await this.prisma.payment.findMany({ where, select: { method: true, amountInPaise: true } });
    const collectionsByMethod: Record<string, number> = {};
    for (const p of payments) {
      collectionsByMethod[p.method] = (collectionsByMethod[p.method] ?? 0) + p.amountInPaise;
    }

    const refunds = await this.prisma.refund.findMany({
      where: {
        status: "SUCCESS",
        createdAt: { gte: query.dateFrom, lte: query.dateTo },
        payment: { order: query.branchId ? { branchId: query.branchId } : undefined },
      },
      select: { amountInPaise: true },
    });
    const totalRefundsInPaise = refunds.reduce((sum, r) => sum + r.amountInPaise, 0);

    const totalCollectedInPaise = Object.values(collectionsByMethod).reduce((sum, v) => sum + v, 0);

    return {
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      branchId: query.branchId ?? null,
      collectionsByMethod,
      totalCollectedInPaise,
      totalRefundsInPaise,
      netCollectedInPaise: totalCollectedInPaise - totalRefundsInPaise,
    };
  }

  // ---------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------

  /**
   * Order.paymentStatus is a denormalized summary of that order's
   * Payment rows — recomputed here after every payment-state change
   * rather than trusted to stay in sync by construction. Each Payment
   * row is treated as atomically PAID or not (partial payment is
   * modeled as multiple full Payment rows — see addManualPayment — not
   * a partially-paid single row), so the aggregation is a straight sum.
   */
  private async recomputeOrderPaymentStatus(tx: PrismaTransactionClient, orderId: string): Promise<void> {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { payments: { include: { refunds: true } } } });

    const totalPaid = order.payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.amountInPaise, 0);
    const totalRefunded = order.payments
      .flatMap((p) => p.refunds)
      .filter((r) => r.status === "SUCCESS")
      .reduce((sum, r) => sum + r.amountInPaise, 0);

    let paymentStatus: "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "PARTIALLY_REFUNDED";
    if (totalRefunded > 0) {
      paymentStatus = totalRefunded >= totalPaid ? "REFUNDED" : "PARTIALLY_REFUNDED";
    } else if (totalPaid >= order.totalInPaise && order.totalInPaise > 0) {
      paymentStatus = "PAID";
    } else if (totalPaid === 0 && order.payments.length > 0 && order.payments.every((p) => p.status === "FAILED")) {
      paymentStatus = "FAILED";
    } else {
      paymentStatus = "PENDING";
    }

    await tx.order.update({ where: { id: orderId }, data: { paymentStatus } });
  }
}
