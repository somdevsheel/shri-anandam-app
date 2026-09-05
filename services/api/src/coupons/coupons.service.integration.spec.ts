import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { PrismaService } from "../database/prisma.service";
import { AuditLogService } from "../audit/audit-log.service";
import { CouponsService } from "./coupons.service";

/**
 * Real integration test against PostgreSQL, matching this codebase's own
 * convention for business-logic-heavy services (see
 * orders.service.integration.spec.ts) — resolveForCart is the one piece
 * of new discount math in the whole coupons feature, so it's the one
 * thing that needs real assertions, not just a manual smoke test.
 */
describe("CouponsService.resolveForCart (integration)", () => {
  const prisma = new PrismaClient();
  const coupons = new CouponsService(prisma as unknown as PrismaService, new AuditLogService(prisma as unknown as PrismaService));

  const suffix = randomUUID().slice(0, 8);
  let organizationId: string;
  let branchId: string;
  let otherBranchId: string;
  let customerId: string;

  const HOUR = 60 * 60 * 1000;
  const activeWindow = { startsAt: new Date(Date.now() - HOUR), endsAt: new Date(Date.now() + HOUR) };

  function cartState(subtotalInPaise: number, forBranchId: string = branchId) {
    return { cart: { branchId: forBranchId } as never, subtotalInPaise };
  }

  async function makeCoupon(overrides: Partial<Parameters<typeof prisma.coupon.create>[0]["data"]>) {
    return prisma.coupon.create({
      data: {
        code: `CPN-${suffix}-${randomUUID().slice(0, 6)}`.toUpperCase(),
        type: "PERCENTAGE",
        value: 10,
        ...activeWindow,
        ...overrides,
      },
    });
  }

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: `Coupons Test Org ${suffix}` } });
    organizationId = org.id;
    const branch = await prisma.branch.create({ data: { organizationId, name: "Coupons Test Branch", address: "x", code: `CPN-${suffix}` } });
    branchId = branch.id;
    const other = await prisma.branch.create({ data: { organizationId, name: "Coupons Other Branch", address: "y", code: `CPN-OTHER-${suffix}` } });
    otherBranchId = other.id;
    const customer = await prisma.customer.create({ data: { mobileNumber: `+91${suffix.padStart(10, "8")}`.slice(0, 13), name: "Coupons Test Customer" } });
    customerId = customer.id;
  });

  afterAll(async () => {
    await prisma.couponUsage.deleteMany({ where: { customerId } });
    await prisma.coupon.deleteMany({ where: { code: { contains: `CPN-${suffix}` } } });
    await prisma.order.deleteMany({ where: { customerId } });
    await prisma.customer.delete({ where: { id: customerId } });
    await prisma.branch.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("rejects an unknown code", async () => {
    const result = await coupons.resolveForCart(customerId, "NOPE-DOES-NOT-EXIST", cartState(100000));
    expect(result.valid).toBe(false);
  });

  it("rejects a coupon that hasn't started yet", async () => {
    const coupon = await makeCoupon({ startsAt: new Date(Date.now() + HOUR), endsAt: new Date(Date.now() + 2 * HOUR) });
    const result = await coupons.resolveForCart(customerId, coupon.code, cartState(100000));
    expect(result).toEqual({ valid: false, message: "This coupon isn't active yet" });
  });

  it("rejects an expired coupon", async () => {
    const coupon = await makeCoupon({ startsAt: new Date(Date.now() - 2 * HOUR), endsAt: new Date(Date.now() - HOUR) });
    const result = await coupons.resolveForCart(customerId, coupon.code, cartState(100000));
    expect(result).toEqual({ valid: false, message: "This coupon has expired" });
  });

  it("rejects a cart below minOrderInPaise", async () => {
    const coupon = await makeCoupon({ minOrderInPaise: 50000 });
    const result = await coupons.resolveForCart(customerId, coupon.code, cartState(10000));
    expect(result.valid).toBe(false);
  });

  it("rejects a coupon scoped to a different branch", async () => {
    const coupon = await makeCoupon({ branchId: otherBranchId });
    const result = await coupons.resolveForCart(customerId, coupon.code, cartState(100000, branchId));
    expect(result).toEqual({ valid: false, message: "This coupon isn't valid for this branch" });
  });

  it("allows a branch-scoped coupon on its own branch", async () => {
    const coupon = await makeCoupon({ branchId, type: "FIXED", value: 5000 });
    const result = await coupons.resolveForCart(customerId, coupon.code, cartState(100000, branchId));
    expect(result).toEqual({ valid: true, coupon: expect.objectContaining({ id: coupon.id }), discountInPaise: 5000 });
  });

  it("computes PERCENTAGE discount correctly", async () => {
    const coupon = await makeCoupon({ type: "PERCENTAGE", value: 15 });
    const result = await coupons.resolveForCart(customerId, coupon.code, cartState(100000));
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.discountInPaise).toBe(15000);
  });

  it("computes FIXED discount correctly", async () => {
    const coupon = await makeCoupon({ type: "FIXED", value: 7500 });
    const result = await coupons.resolveForCart(customerId, coupon.code, cartState(100000));
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.discountInPaise).toBe(7500);
  });

  it("caps the discount at maxDiscountInPaise", async () => {
    const coupon = await makeCoupon({ type: "PERCENTAGE", value: 50, maxDiscountInPaise: 20000 });
    const result = await coupons.resolveForCart(customerId, coupon.code, cartState(100000));
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.discountInPaise).toBe(20000); // 50% of 1000 would be 500, capped to 200
  });

  it("never discounts more than the subtotal itself", async () => {
    const coupon = await makeCoupon({ type: "FIXED", value: 999999 });
    const result = await coupons.resolveForCart(customerId, coupon.code, cartState(10000));
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.discountInPaise).toBe(10000);
  });

  it("rejects once usageLimit is exhausted", async () => {
    const coupon = await makeCoupon({ usageLimit: 1 });
    const order = await prisma.order.create({
      data: {
        orderNumber: `CPN-ORD-${suffix}`,
        branchId,
        customerId,
        fulfillmentType: "PICKUP",
        subtotalInPaise: 100000,
        totalInPaise: 100000,
      },
    });
    await prisma.couponUsage.create({ data: { couponId: coupon.id, customerId, orderId: order.id, discountAppliedInPaise: 10000 } });

    const result = await coupons.resolveForCart(customerId, coupon.code, cartState(100000));
    expect(result).toEqual({ valid: false, message: "This coupon has reached its usage limit" });
  });

  it("rejects once perCustomerLimit is exceeded for this customer", async () => {
    const coupon = await makeCoupon({ perCustomerLimit: 1 });
    const order = await prisma.order.create({
      data: {
        orderNumber: `CPN-ORD2-${suffix}`,
        branchId,
        customerId,
        fulfillmentType: "PICKUP",
        subtotalInPaise: 100000,
        totalInPaise: 100000,
      },
    });
    await prisma.couponUsage.create({ data: { couponId: coupon.id, customerId, orderId: order.id, discountAppliedInPaise: 10000 } });

    const result = await coupons.resolveForCart(customerId, coupon.code, cartState(100000));
    expect(result).toEqual({ valid: false, message: "You've already used this coupon" });
  });

  it("rejects an isFirstOrderOnly coupon for a customer who has already ordered", async () => {
    const coupon = await makeCoupon({ isFirstOrderOnly: true });
    await prisma.order.create({
      data: {
        orderNumber: `CPN-ORD3-${suffix}`,
        branchId,
        customerId,
        fulfillmentType: "PICKUP",
        subtotalInPaise: 100000,
        totalInPaise: 100000,
      },
    });

    const result = await coupons.resolveForCart(customerId, coupon.code, cartState(100000));
    expect(result).toEqual({ valid: false, message: "This coupon is for first-time customers only" });
  });

  it("is case-insensitive on the code", async () => {
    const coupon = await makeCoupon({ type: "FIXED", value: 1000 });
    const result = await coupons.resolveForCart(customerId, coupon.code.toLowerCase(), cartState(100000));
    expect(result.valid).toBe(true);
  });
});
