import { Injectable } from "@nestjs/common";
import { Prisma, type ActorType, type CustomerAddress } from "@prisma/client";
import {
  DomainEvent,
  ErrorCode,
  isValidOrderStatusTransition,
  OFFLINE_PAYMENT_METHODS,
  OrderStatus,
  Permission,
} from "@shri-anandam/shared-types";
import { HttpStatus, Logger } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import type { PrismaTransactionClient } from "../database/prisma.service";
import { AuditLogService } from "../audit/audit-log.service";
import { OutboxService } from "../outbox/outbox.service";
import { InventoryReservationService } from "../inventory/inventory-reservation.service";
import { CartService } from "../cart/cart.service";
import { PaymentsService } from "../payments/payments.service";
import { OrderNumberService } from "./order-number.service";
import { DeliveryFeeService } from "./delivery-fee.service";
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../common/errors/app.error";
import { paginate } from "../common/util/paginate";
import type { AuthenticatedCustomer, AuthenticatedStaff } from "../auth/types/authenticated-user.type";
import type {
  AddOrderNoteDto,
  CancelOrderDto,
  CreateOrderDto,
  ListMyOrdersQueryDto,
  ListOrdersAdminQueryDto,
  UpdateOrderStatusDto,
} from "@shri-anandam/validation";

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

const ORDER_DETAIL_INCLUDE = {
  branch: true,
  items: { include: { addons: true } },
  addressSnapshot: true,
  statusHistory: { orderBy: { createdAt: "asc" } },
  notes: { orderBy: { createdAt: "asc" } },
  payments: { include: { transactions: true } },
} satisfies Prisma.OrderInclude;

const STATUS_TO_EVENT: Record<OrderStatus, DomainEvent> = {
  [OrderStatus.PENDING]: DomainEvent.ORDER_CREATED,
  [OrderStatus.ACCEPTED]: DomainEvent.ORDER_ACCEPTED,
  [OrderStatus.PREPARING]: DomainEvent.ORDER_PREPARING,
  [OrderStatus.READY]: DomainEvent.ORDER_READY,
  [OrderStatus.OUT_FOR_DELIVERY]: DomainEvent.ORDER_OUT_FOR_DELIVERY,
  [OrderStatus.DELIVERED]: DomainEvent.ORDER_DELIVERED,
  [OrderStatus.REJECTED]: DomainEvent.ORDER_REJECTED,
  [OrderStatus.CANCELLED]: DomainEvent.ORDER_CANCELLED,
};

/** Which permission a staff-initiated transition to a given status requires — see updateStatus(). */
const STATUS_PERMISSION: Record<OrderStatus, Permission | null> = {
  [OrderStatus.PENDING]: null, // never a target status for a transition
  [OrderStatus.ACCEPTED]: Permission.ORDER_ACCEPT,
  [OrderStatus.PREPARING]: Permission.ORDER_ACCEPT, // fulfillment workflow, same permission KITCHEN already holds
  [OrderStatus.READY]: Permission.ORDER_ACCEPT,
  [OrderStatus.OUT_FOR_DELIVERY]: Permission.ORDER_ACCEPT,
  [OrderStatus.DELIVERED]: Permission.ORDER_ACCEPT,
  [OrderStatus.REJECTED]: Permission.ORDER_REJECT,
  [OrderStatus.CANCELLED]: Permission.ORDER_CANCEL,
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly outbox: OutboxService,
    private readonly reservations: InventoryReservationService,
    private readonly cart: CartService,
    private readonly payments: PaymentsService,
    private readonly orderNumbers: OrderNumberService,
    private readonly deliveryFee: DeliveryFeeService,
  ) {}

  // ---------------------------------------------------------------------
  // Checkout / creation
  // ---------------------------------------------------------------------

  async createOrder(
    customer: AuthenticatedCustomer,
    dto: CreateOrderDto,
    idempotencyKey: string | undefined,
    ctx: RequestContext,
  ) {
    // section 11: replay-safe. A network retry of the exact same
    // checkout attempt returns the order already created for this key
    // instead of creating a second one.
    if (idempotencyKey) {
      const existing = await this.prisma.order.findUnique({
        where: { idempotencyKey },
        include: ORDER_DETAIL_INCLUDE,
      });
      if (existing) return existing;
    }

    const cartState = await this.cart.getCart(customer.id);
    if (!cartState.cart || cartState.cart.items.length === 0) {
      throw new ValidationError("Your cart is empty");
    }
    if (cartState.issues.length > 0) {
      throw new ValidationError(
        "Your cart has items that need attention before checkout",
        cartState.issues.map((issue) => ({ field: issue.cartItemId, message: issue.message })),
      );
    }

    const branchId = cartState.cart.branchId;
    let deliveryFeeInPaise = 0;
    let resolvedAddress: CustomerAddress | null = null;

    if (dto.fulfillmentType === "DELIVERY") {
      resolvedAddress = await this.prisma.customerAddress.findUnique({ where: { id: dto.addressId } });
      if (!resolvedAddress || resolvedAddress.customerId !== customer.id) {
        throw new NotFoundError("CustomerAddress", dto.addressId);
      }
      const fee = await this.deliveryFee.resolve(branchId, resolvedAddress.pincode, cartState.subtotalInPaise);
      deliveryFeeInPaise = fee.deliveryFeeInPaise;
    }

    const discountInPaise = 0; // no coupon engine yet — see docs/architecture/decisions.md
    const taxInPaise = 0; // tax computation not implemented yet — see docs/architecture/decisions.md
    const totalInPaise = cartState.subtotalInPaise - discountInPaise + deliveryFeeInPaise + taxInPaise;

    // Phase 7 (ADR-015/017): offline methods (COD/Pay-at-Store) have no
    // async confirmation step, so stock is reserved AND consumed in this
    // same transaction. Online methods (UPI/CARD/NET_BANKING) only
    // reserve — consumption happens when the Razorpay webhook confirms
    // payment (PaymentsService.handleWebhook), so a customer who never
    // completes payment simply lets the reservation expire without ever
    // having decremented real stock.
    const isOfflinePayment = OFFLINE_PAYMENT_METHODS.has(dto.paymentMethod);

    try {
      const order = await this.prisma.$transaction(async (tx) => {
        const orderNumber = await this.orderNumbers.next(tx);

        const order = await tx.order.create({
          data: {
            orderNumber,
            branchId,
            customerId: customer.id,
            status: OrderStatus.PENDING,
            fulfillmentType: dto.fulfillmentType,
            scheduledFor: dto.scheduledFor,
            subtotalInPaise: cartState.subtotalInPaise,
            discountInPaise,
            deliveryFeeInPaise,
            taxInPaise,
            totalInPaise,
            idempotencyKey,
            items: {
              create: cartState.cart!.items.map((item) => ({
                productId: item.product.id,
                variantId: item.variant.id,
                productNameSnapshot: item.product.name,
                variantNameSnapshot: item.variant.name,
                quantity: item.quantity,
                unitPriceInPaise: item.unitPriceInPaise,
                discountInPaise: 0,
                taxInPaise: 0,
                // Per-line total (unit price × quantity) — discount/tax
                // are 0 today so this is unambiguous; once coupons/tax
                // land, finalPriceInPaise = (unitPrice - discount + tax) × quantity.
                finalPriceInPaise: item.unitPriceInPaise * item.quantity,
                specialInstructions: item.specialInstructions,
                addons: {
                  create: item.addons.map((addon) => ({
                    addonId: addon.id,
                    addonNameSnapshot: addon.name,
                    priceInPaiseSnapshot: addon.priceInPaise,
                  })),
                },
              })),
            },
            payments: {
              create: {
                provider: isOfflinePayment ? "MANUAL" : "RAZORPAY",
                method: dto.paymentMethod,
                status: "PENDING",
                amountInPaise: totalInPaise,
              },
            },
          },
          include: ORDER_DETAIL_INCLUDE,
        });

        // Reserve stock for every inventory-tracked line, now that
        // order.id exists to attribute the hold to. If any line is
        // actually out of stock, reserve() throws and the whole
        // transaction — order, items, payment, everything above — rolls
        // back together; nothing here is a partial commit. Untracked
        // variants (no InventoryItem row) are treated as unlimited,
        // matching CartService's own availability semantics.
        for (const item of order.items) {
          const inventoryItem = await tx.inventoryItem.findUnique({
            where: { branchId_productVariantId: { branchId, productVariantId: item.variantId } },
          });
          if (inventoryItem) {
            const reservation = await this.reservations.reserve(tx, {
              branchId,
              productVariantId: item.variantId,
              quantity: item.quantity,
              orderId: order.id,
            });
            // Offline methods confirm instantly, so the hold becomes a
            // real sale immediately (see the isOfflinePayment comment
            // above); online methods leave it ACTIVE for the webhook.
            if (isOfflinePayment) {
              await this.reservations.consume(tx, reservation.id, order.id);
            }
          }
        }

        if (resolvedAddress) {
          await tx.orderAddressSnapshot.create({
            data: {
              orderId: order.id,
              contactName: resolvedAddress.contactName,
              contactPhone: resolvedAddress.contactPhone,
              line1: resolvedAddress.line1,
              line2: resolvedAddress.line2,
              city: resolvedAddress.city,
              state: resolvedAddress.state,
              pincode: resolvedAddress.pincode,
              latitude: resolvedAddress.latitude,
              longitude: resolvedAddress.longitude,
            },
          });
        }

        await tx.orderStatusHistory.create({
          data: { orderId: order.id, previousStatus: null, newStatus: OrderStatus.PENDING, actorId: customer.id, actorType: "CUSTOMER" },
        });
        await tx.orderEvent.create({
          data: {
            orderId: order.id,
            eventType: DomainEvent.ORDER_CREATED,
            payload: { orderNumber, ipAddress: ctx.ipAddress, userAgent: ctx.userAgent },
          },
        });
        await this.outbox.append(tx, {
          aggregateType: "Order",
          aggregateId: order.id,
          eventType: DomainEvent.ORDER_CREATED,
          payload: { orderId: order.id, orderNumber, branchId, totalInPaise, itemCount: cartState.itemCount },
        });

        await tx.cart.deleteMany({ where: { customerId: customer.id } });

        // `order` above was captured by tx.order.create() before the
        // status history / address snapshot rows were written — Prisma
        // doesn't live-update an already-returned object as sibling rows
        // are created in the same transaction, so returning it directly
        // would silently ship an empty statusHistory/addressSnapshot to
        // the client despite both existing in the DB by commit time.
        return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: ORDER_DETAIL_INCLUDE });
      });

      if (!isOfflinePayment) {
        // Deliberately OUTSIDE the DB transaction above: an external
        // HTTP call to Razorpay has no business holding row locks open
        // for however long the network takes. If this fails, the order
        // still exists with a PENDING payment lacking a providerOrderId
        // — the client (or the customer retrying) can call
        // POST /payments/:id/initiate to try again; it isn't stranded.
        const payment = order.payments[0];
        if (payment) {
          try {
            const initiated = await this.payments.initiatePayment(customer.id, payment.id);
            order.payments[0] = { ...payment, providerOrderId: initiated.providerOrderId };
          } catch (err) {
            this.logger.warn(
              `Order ${order.orderNumber} created but online payment initiation failed — customer can retry via POST /payments/:id/initiate: ${err instanceof Error ? err.message : err}`,
            );
          }
        }
      }

      return order;
    } catch (err) {
      // A concurrent retry with the same key can race past the initial
      // lookup above; the unique constraint on idempotencyKey is the
      // real guard — on conflict, return whichever order actually won.
      if (idempotencyKey && err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const winner = await this.prisma.order.findUnique({ where: { idempotencyKey }, include: ORDER_DETAIL_INCLUDE });
        if (winner) return winner;
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------

  async getById(orderId: string, actor: { subjectType: "CUSTOMER" | "STAFF"; id: string; permissions?: Permission[] }) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, include: ORDER_DETAIL_INCLUDE });
    if (!order) throw new NotFoundError("Order", orderId);

    if (actor.subjectType === "CUSTOMER" && order.customerId !== actor.id) {
      throw new NotFoundError("Order", orderId);
    }
    if (actor.subjectType === "STAFF" && !actor.permissions?.includes(Permission.ORDER_READ)) {
      throw new ForbiddenError("Missing required permission: order.read");
    }

    return order;
  }

  async listMine(customerId: string, query: ListMyOrdersQueryDto) {
    const where: Prisma.OrderWhereInput = { customerId, status: query.status };
    return paginate(
      { page: query.page, pageSize: query.pageSize, sortBy: query.sortBy ?? "", sortOrder: query.sortOrder },
      ({ skip, take }) =>
        this.prisma.$transaction([
          this.prisma.order.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: ORDER_DETAIL_INCLUDE }),
          this.prisma.order.count({ where }),
        ]),
    );
  }

  async listAdmin(query: ListOrdersAdminQueryDto) {
    const where: Prisma.OrderWhereInput = {
      branchId: query.branchId,
      status: query.status,
      customerId: query.customerId,
      createdAt: query.dateFrom || query.dateTo ? { gte: query.dateFrom, lte: query.dateTo } : undefined,
    };
    return paginate(
      { page: query.page, pageSize: query.pageSize, sortBy: query.sortBy ?? "", sortOrder: query.sortOrder },
      ({ skip, take }) =>
        this.prisma.$transaction([
          this.prisma.order.findMany({ where, skip, take, orderBy: { createdAt: "desc" }, include: ORDER_DETAIL_INCLUDE }),
          this.prisma.order.count({ where }),
        ]),
    );
  }

  // ---------------------------------------------------------------------
  // State transitions
  // ---------------------------------------------------------------------

  async updateStatus(staff: AuthenticatedStaff, orderId: string, dto: UpdateOrderStatusDto, ctx: RequestContext) {
    const requiredPermission = STATUS_PERMISSION[dto.status];
    if (!requiredPermission || !staff.permissions.includes(requiredPermission)) {
      throw new ForbiddenError(`Missing required permission: ${requiredPermission ?? "unknown"}`);
    }

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundError("Order", orderId);

    return this.transition(order, dto.status, { subjectType: "STAFF", id: staff.id }, dto.reason, ctx);
  }

  async cancelOwnOrder(customer: AuthenticatedCustomer, orderId: string, dto: CancelOrderDto, ctx: RequestContext) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.customerId !== customer.id) throw new NotFoundError("Order", orderId);

    return this.transition(order, OrderStatus.CANCELLED, { subjectType: "CUSTOMER", id: customer.id }, dto.reason, ctx);
  }

  private async transition(
    order: { id: string; status: OrderStatus },
    newStatus: OrderStatus,
    actor: { subjectType: ActorType; id: string },
    reason: string | undefined,
    ctx: RequestContext,
  ) {
    if (!isValidOrderStatusTransition(order.status, newStatus)) {
      throw new AppError(
        ErrorCode.INVALID_STATE_TRANSITION,
        `Cannot move an order from ${order.status} to ${newStatus}`,
        HttpStatus.CONFLICT,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { status: newStatus } });

      await tx.orderStatusHistory.create({
        data: { orderId: order.id, previousStatus: order.status, newStatus, actorId: actor.id, actorType: actor.subjectType, reason },
      });
      await tx.orderEvent.create({
        data: { orderId: order.id, eventType: STATUS_TO_EVENT[newStatus], payload: reason ? { reason } : undefined },
      });
      await this.outbox.append(tx, {
        aggregateType: "Order",
        aggregateId: order.id,
        eventType: STATUS_TO_EVENT[newStatus],
        payload: { orderId: order.id, status: newStatus },
      });

      // section 45: order cancellation is an explicitly audited action.
      // Every other transition is logged too — the full staff-driven
      // fulfillment trail is exactly what OrderStatusHistory /
      // AuditLog exist to make reconstructable.
      await this.auditLog.record(
        {
          actor,
          action: `ORDER_STATUS_CHANGED_TO_${newStatus}`,
          entityType: "Order",
          entityId: order.id,
          oldValue: { status: order.status },
          newValue: { status: newStatus, reason },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      if (newStatus === OrderStatus.CANCELLED) {
        await this.restockCancelledOrder(tx, order.id);
      }

      // Fetched fresh (not returned from the update() above) so the
      // response includes the status history / event rows just written
      // in this same transaction — see the identical note in
      // createOrder().
      return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: ORDER_DETAIL_INCLUDE });
    });
  }

  /** Reverses every SALE-type stock consumption this order caused, restoring committed stock. */
  private async restockCancelledOrder(tx: PrismaTransactionClient, orderId: string): Promise<void> {
    const saleTxns = await tx.inventoryTransaction.findMany({ where: { referenceOrderId: orderId, type: "SALE" } });

    for (const txn of saleTxns) {
      const restoredQuantity = txn.quantityDelta.negated(); // SALE deltas are negative; restoring is the positive of that
      await tx.inventoryItem.update({
        where: { id: txn.inventoryItemId },
        data: { stockQuantity: { increment: restoredQuantity } },
      });
      await tx.inventoryTransaction.create({
        data: {
          inventoryItemId: txn.inventoryItemId,
          type: "ADJUSTMENT",
          quantityDelta: restoredQuantity,
          referenceOrderId: orderId,
          note: "Order cancelled — stock restored",
        },
      });
    }
  }

  // ---------------------------------------------------------------------
  // Notes (staff)
  // ---------------------------------------------------------------------

  async addNote(staff: AuthenticatedStaff, orderId: string, dto: AddOrderNoteDto) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, select: { id: true } });
    if (!order) throw new NotFoundError("Order", orderId);

    return this.prisma.orderNote.create({ data: { orderId, authorStaffId: staff.id, note: dto.note } });
  }

  // ---------------------------------------------------------------------
  // Reorder
  // ---------------------------------------------------------------------

  /**
   * Re-adds a past order's items to the (current) cart at TODAY's
   * prices and availability — never the historical snapshot — per
   * section 6's "never trust stale pricing" rule applied to Reorder
   * specifically. Items whose product/variant is no longer available
   * are skipped and reported, not silently dropped; a branch mismatch
   * with the customer's current cart aborts immediately with one clear
   * message rather than failing every line individually.
   */
  async reorder(customer: AuthenticatedCustomer, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { addons: true } } },
    });
    if (!order || order.customerId !== customer.id) throw new NotFoundError("Order", orderId);

    const skipped: { productName: string; reason: string }[] = [];
    let cartState = await this.cart.getCart(customer.id);

    for (const item of order.items) {
      try {
        cartState = await this.cart.addItem(customer.id, {
          branchId: order.branchId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          addonIds: item.addons.filter((a) => a.addonId).map((a) => a.addonId as string),
          specialInstructions: item.specialInstructions ?? undefined,
        });
      } catch (err) {
        if (err instanceof ConflictError) throw err; // branch mismatch — whole-cart issue, fail fast
        if (err instanceof ValidationError) {
          skipped.push({ productName: item.productNameSnapshot, reason: err.message });
          continue;
        }
        throw err;
      }
    }

    return { ...cartState, skipped };
  }
}
