import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { OrderStatus } from "@shri-anandam/shared-types";
import type { PrismaService } from "../database/prisma.service";
import { AuditLogService } from "../audit/audit-log.service";
import { OutboxService } from "../outbox/outbox.service";
import { InventoryReservationService } from "../inventory/inventory-reservation.service";
import { InventoryService } from "../inventory/inventory.service";
import { CartService } from "../cart/cart.service";
import { PaymentsService } from "../payments/payments.service";
import { ManualPaymentProvider } from "../payments/providers/manual-payment.provider";
import { OrdersService } from "./orders.service";
import { OrderNumberService } from "./order-number.service";
import { DeliveryFeeService } from "./delivery-fee.service";
import type { RealtimeGateway } from "../realtime/realtime.gateway";
import type { AuthenticatedCustomer } from "../auth/types/authenticated-user.type";

/**
 * Real integration test against PostgreSQL — section 11 requires that
 * tapping "Place Order" multiple times (a slow/flaky network retrying
 * the same request) creates exactly one order, and section 62 explicitly
 * calls out testing duplicate requests. The decisive case below fires N
 * genuinely concurrent createOrder() calls with the SAME idempotency key
 * (Promise.all, not sequential awaits) and asserts only one order — and
 * one stock consumption — resulted, which only holds if the unique
 * constraint + P2002 recovery path in OrdersService actually works
 * under a real race, not just in the sequential-request case.
 */
describe("OrdersService (integration)", () => {
  const prisma = new PrismaClient();
  const outbox = new OutboxService();
  const inventoryReservations = new InventoryReservationService(prisma as unknown as PrismaService, outbox);
  const inventory = new InventoryService(prisma as unknown as PrismaService, new AuditLogService(prisma as unknown as PrismaService), inventoryReservations);
  const cart = new CartService(prisma as unknown as PrismaService, inventory);
  // Every order in this suite pays by COD (an offline method), which
  // never calls into PaymentProvider at all (see ADR-015/017) — the
  // no-op ManualPaymentProvider here is never actually exercised, only
  // satisfies PaymentsService's constructor.
  const payments = new PaymentsService(
    prisma as unknown as PrismaService,
    new AuditLogService(prisma as unknown as PrismaService),
    outbox,
    inventoryReservations,
    new ManualPaymentProvider(),
  );
  // A real RealtimeGateway needs a live JwtService/ConfigService and
  // isn't what this suite is testing (it verifies OrdersService's own
  // logic, not the WebSocket broadcast) — a minimal fake satisfying the
  // two methods OrdersService actually calls is enough, same pattern as
  // this file's `prisma as unknown as PrismaService` casts below.
  const realtime = { emitOrderCreated: () => undefined, emitOrderUpdated: () => undefined } as unknown as RealtimeGateway;
  const orders = new OrdersService(
    prisma as unknown as PrismaService,
    new AuditLogService(prisma as unknown as PrismaService),
    outbox,
    inventoryReservations,
    cart,
    payments,
    new OrderNumberService(),
    new DeliveryFeeService(prisma as unknown as PrismaService),
    realtime,
  );

  const suffix = randomUUID().slice(0, 8);
  let organizationId: string;
  let branchId: string;
  let categoryId: string;
  let productId: string;
  let variantId: string;
  let inventoryItemId: string;
  let customer: AuthenticatedCustomer;

  async function freshCart(quantity: number) {
    await prisma.cart.deleteMany({ where: { customerId: customer.id } });
    const c = await prisma.cart.create({ data: { customerId: customer.id, branchId } });
    await prisma.cartItem.create({ data: { cartId: c.id, productId, variantId, quantity } });
  }

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: `Orders Test Org ${suffix}` } });
    organizationId = org.id;
    const branch = await prisma.branch.create({
      data: { organizationId, name: "Orders Test Branch", address: "x", code: `ORD-${suffix}` },
    });
    branchId = branch.id;
    const category = await prisma.category.create({ data: { name: `Orders Cat ${suffix}`, slug: `orders-cat-${suffix}` } });
    categoryId = category.id;
    const product = await prisma.product.create({
      data: {
        categoryId,
        name: `Orders Product ${suffix}`,
        slug: `orders-product-${suffix}`,
        branchProducts: { create: { branchId } },
      },
    });
    productId = product.id;
    const variant = await prisma.productVariant.create({
      data: { productId, name: "Regular", sku: `ORD-SKU-${suffix}`, priceInPaise: 10000 },
    });
    variantId = variant.id;
    const item = await prisma.inventoryItem.create({
      data: { branchId, productVariantId: variantId, unit: "PIECE", stockQuantity: 100, lowStockThreshold: 0 },
    });
    inventoryItemId = item.id;

    const c = await prisma.customer.create({ data: { mobileNumber: `+91${suffix.padStart(10, "9")}`.slice(0, 13), name: "Orders Test Customer" } });
    customer = { subjectType: "CUSTOMER", id: c.id, mobileNumber: c.mobileNumber };
  });

  afterAll(async () => {
    // Payment and InventoryTransaction deliberately do NOT cascade-delete
    // from Order (an order is never hard-deleted in production — see
    // their schema.prisma comments), so a raw `order.deleteMany()` here
    // hits the same FK restriction production relies on. Clean up in
    // dependency order instead.
    const orderIds = (await prisma.order.findMany({ where: { branchId }, select: { id: true } })).map((o) => o.id);
    await prisma.paymentTransaction.deleteMany({ where: { payment: { orderId: { in: orderIds } } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.inventoryTransaction.deleteMany({ where: { inventoryItemId } });
    await prisma.stockReservation.deleteMany({ where: { inventoryItemId } });
    await prisma.order.deleteMany({ where: { branchId } });
    await prisma.cart.deleteMany({ where: { customerId: customer.id } });
    await prisma.inventoryItem.delete({ where: { id: inventoryItemId } });
    await prisma.customer.delete({ where: { id: customer.id } });
    await prisma.productVariant.delete({ where: { id: variantId } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.branch.delete({ where: { id: branchId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("creates an order, decrements stock, and clears the cart", async () => {
    await freshCart(3);
    const stockBefore = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItemId } });

    const order = await orders.createOrder(customer, { fulfillmentType: "PICKUP", paymentMethod: "COD" }, undefined, {});

    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.totalInPaise).toBe(30000);
    expect(order.statusHistory).toHaveLength(1);

    const stockAfter = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItemId } });
    expect(stockAfter.stockQuantity.toString()).toBe(stockBefore.stockQuantity.minus(3).toString());

    const remainingCart = await prisma.cart.findUnique({ where: { customerId: customer.id } });
    expect(remainingCart).toBeNull();
  });

  it("rejects an invalid transition (the brief's own example: DELIVERED -> PREPARING)", async () => {
    await freshCart(1);
    const order = await orders.createOrder(customer, { fulfillmentType: "PICKUP", paymentMethod: "COD" }, undefined, {});

    const staffCtx = { subjectType: "STAFF" as const, id: "staff-test", email: "t@test.local", permissions: ["order.accept", "order.reject", "order.cancel"] as never };
    await orders.updateStatus(staffCtx, order.id, { status: OrderStatus.ACCEPTED }, {});
    await orders.updateStatus(staffCtx, order.id, { status: OrderStatus.PREPARING }, {});
    await orders.updateStatus(staffCtx, order.id, { status: OrderStatus.READY }, {});
    await orders.updateStatus(staffCtx, order.id, { status: OrderStatus.DELIVERED }, {});

    await expect(
      orders.updateStatus(staffCtx, order.id, { status: OrderStatus.PREPARING }, {}),
    ).rejects.toThrow();
  });

  it("cancellation restores the exact stock the order consumed", async () => {
    await freshCart(5);
    const stockBefore = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItemId } });

    const order = await orders.createOrder(customer, { fulfillmentType: "PICKUP", paymentMethod: "COD" }, undefined, {});
    const afterOrder = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItemId } });
    expect(afterOrder.stockQuantity.toString()).toBe(stockBefore.stockQuantity.minus(5).toString());

    await orders.cancelOwnOrder(customer, order.id, {}, {});

    const afterCancel = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItemId } });
    expect(afterCancel.stockQuantity.toString()).toBe(stockBefore.stockQuantity.toString());
  });

  it(
    "CRITICAL: concurrent createOrder() calls with the same idempotency key produce exactly one order",
    async () => {
      await freshCart(1);
      const idempotencyKey = `concurrent-test-${suffix}`;

      const attempts = Array.from({ length: 10 }, () =>
        orders.createOrder(customer, { fulfillmentType: "PICKUP", paymentMethod: "COD" }, idempotencyKey, {}),
      );

      const results = await Promise.all(attempts);
      const orderIds = new Set(results.map((r) => r.id));

      // Every concurrent caller got back the SAME order, not ten different ones.
      expect(orderIds.size).toBe(1);

      const ordersInDb = await prisma.order.count({ where: { idempotencyKey } });
      expect(ordersInDb).toBe(1);

      // Exactly one unit of stock consumed — not ten.
      const saleTxns = await prisma.inventoryTransaction.aggregate({
        where: { inventoryItemId, type: "SALE", referenceOrderId: [...orderIds][0] },
        _sum: { quantityDelta: true },
      });
      expect(saleTxns._sum.quantityDelta?.toString()).toBe("-1");
    },
    20_000,
  );
});
