import { randomUUID } from "node:crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import type { PrismaService } from "../database/prisma.service";
import { OutboxService } from "../outbox/outbox.service";
import { InventoryReservationService } from "./inventory-reservation.service";
import { InsufficientStockError } from "../common/errors/app.error";

/**
 * Real integration test against PostgreSQL — this is the test that
 * proves section 31's requirement ("Inventory must be transaction-safe.
 * Do not allow two simultaneous orders to consume stock that does not
 * exist") actually holds, not just that the code compiles. The decisive
 * case fires N genuinely concurrent reservation requests (via
 * Promise.all — not sequential awaits) against a fixed stock pool and
 * asserts the accepted total never exceeds what existed, which only
 * holds if `reserve()`'s `SELECT ... FOR UPDATE` is really serializing
 * concurrent callers rather than racing on a check-then-act read.
 */
describe("InventoryReservationService (integration)", () => {
  const prisma = new PrismaClient();
  const reservations = new InventoryReservationService(prisma as unknown as PrismaService, new OutboxService());

  const suffix = randomUUID().slice(0, 8);
  let organizationId: string;
  let branchId: string;
  let categoryId: string;
  let productId: string;
  let variantId: string;
  let itemId: string;

  async function createItem(stockQuantity: number, lowStockThreshold = 0) {
    const item = await prisma.inventoryItem.create({
      data: { branchId, productVariantId: variantId, unit: "GRAM", stockQuantity, lowStockThreshold },
    });
    return item.id;
  }

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: `Inv Test Org ${suffix}` } });
    organizationId = org.id;
    const branch = await prisma.branch.create({
      data: { organizationId, name: "Inv Test Branch", address: "x", code: `INV-${suffix}` },
    });
    branchId = branch.id;
    const category = await prisma.category.create({ data: { name: `Inv Cat ${suffix}`, slug: `inv-cat-${suffix}` } });
    categoryId = category.id;
    const product = await prisma.product.create({
      data: { categoryId, name: `Inv Product ${suffix}`, slug: `inv-product-${suffix}` },
    });
    productId = product.id;
    const variant = await prisma.productVariant.create({
      data: { productId, name: "500g", sku: `INV-SKU-${suffix}`, priceInPaise: 1000 },
    });
    variantId = variant.id;
  });

  afterEach(async () => {
    if (itemId) {
      await prisma.stockReservation.deleteMany({ where: { inventoryItemId: itemId } });
      await prisma.inventoryTransaction.deleteMany({ where: { inventoryItemId: itemId } });
      await prisma.inventoryItem.delete({ where: { id: itemId } }).catch(() => undefined);
    }
  });

  afterAll(async () => {
    await prisma.productVariant.delete({ where: { id: variantId } });
    await prisma.product.delete({ where: { id: productId } });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.branch.delete({ where: { id: branchId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("reserve() does not touch stockQuantity — only marks a hold", async () => {
    itemId = await createItem(1000);
    const { id } = await reservations.reserveStandalone({ branchId, productVariantId: variantId, quantity: 500 });

    const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(item.stockQuantity.toString()).toBe("1000");

    const reservation = await prisma.stockReservation.findUniqueOrThrow({ where: { id } });
    expect(reservation.status).toBe("ACTIVE");
    expect(reservation.quantity.toString()).toBe("500");
  });

  it("consume() decrements stockQuantity and marks the reservation CONSUMED", async () => {
    itemId = await createItem(1000);
    const { id } = await reservations.reserveStandalone({ branchId, productVariantId: variantId, quantity: 500 });

    await prisma.$transaction((tx) => reservations.consume(tx, id));

    const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(item.stockQuantity.toString()).toBe("500");
    const reservation = await prisma.stockReservation.findUniqueOrThrow({ where: { id } });
    expect(reservation.status).toBe("CONSUMED");

    const txn = await prisma.inventoryTransaction.findFirstOrThrow({ where: { inventoryItemId: itemId, type: "SALE" } });
    expect(txn.quantityDelta.toString()).toBe("-500");
  });

  it("release() frees the hold without touching stockQuantity", async () => {
    itemId = await createItem(1000);
    const { id } = await reservations.reserveStandalone({ branchId, productVariantId: variantId, quantity: 500 });

    await prisma.$transaction((tx) => reservations.release(tx, id));

    const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
    expect(item.stockQuantity.toString()).toBe("1000");
    const reservation = await prisma.stockReservation.findUniqueOrThrow({ where: { id } });
    expect(reservation.status).toBe("RELEASED");

    // Freed capacity is immediately reservable again.
    await expect(
      reservations.reserveStandalone({ branchId, productVariantId: variantId, quantity: 1000 }),
    ).resolves.toBeDefined();
  });

  it("rejects a reservation that exceeds available stock", async () => {
    itemId = await createItem(100);
    await expect(
      reservations.reserveStandalone({ branchId, productVariantId: variantId, quantity: 101 }),
    ).rejects.toThrow(InsufficientStockError);
  });

  it("accounts for already-active reservations when computing availability", async () => {
    itemId = await createItem(100);
    await reservations.reserveStandalone({ branchId, productVariantId: variantId, quantity: 60 });

    // 60 already held -> only 40 left, so 50 should be rejected...
    await expect(
      reservations.reserveStandalone({ branchId, productVariantId: variantId, quantity: 50 }),
    ).rejects.toThrow(InsufficientStockError);

    // ...but exactly 40 should succeed.
    await expect(
      reservations.reserveStandalone({ branchId, productVariantId: variantId, quantity: 40 }),
    ).resolves.toBeDefined();
  });

  it("excludes expired (but not-yet-swept) reservations from availability", async () => {
    itemId = await createItem(100);
    // Simulate a reservation whose TTL has already lapsed but the cron
    // hasn't swept it to EXPIRED yet — reserve() must still treat it as
    // freed capacity, not rely on the cron for correctness.
    await prisma.stockReservation.create({
      data: { inventoryItemId: itemId, quantity: 80, status: "ACTIVE", expiresAt: new Date(Date.now() - 60_000) },
    });

    await expect(
      reservations.reserveStandalone({ branchId, productVariantId: variantId, quantity: 90 }),
    ).resolves.toBeDefined();
  });

  it("expireStaleReservations() sweeps past-due ACTIVE holds to EXPIRED", async () => {
    itemId = await createItem(100);
    const stale = await prisma.stockReservation.create({
      data: { inventoryItemId: itemId, quantity: 10, status: "ACTIVE", expiresAt: new Date(Date.now() - 1000) },
    });
    const fresh = await prisma.stockReservation.create({
      data: { inventoryItemId: itemId, quantity: 10, status: "ACTIVE", expiresAt: new Date(Date.now() + 60_000) },
    });

    await reservations.expireStaleReservations();

    expect((await prisma.stockReservation.findUniqueOrThrow({ where: { id: stale.id } })).status).toBe("EXPIRED");
    expect((await prisma.stockReservation.findUniqueOrThrow({ where: { id: fresh.id } })).status).toBe("ACTIVE");
  });

  it(
    "CRITICAL: never oversells under genuinely concurrent reservation requests",
    async () => {
      itemId = await createItem(1000); // exactly enough for 10 concurrent requests of 100 each

      const attempts = Array.from({ length: 20 }, () =>
        reservations
          .reserveStandalone({ branchId, productVariantId: variantId, quantity: 100 })
          .then(() => "fulfilled" as const)
          .catch((err) => {
            if (err instanceof InsufficientStockError) return "rejected" as const;
            throw err; // an unexpected error must fail the test, not be swallowed as "rejected"
          }),
      );

      const results = await Promise.all(attempts);
      const fulfilled = results.filter((r) => r === "fulfilled").length;
      const rejected = results.filter((r) => r === "rejected").length;

      expect(fulfilled).toBe(10); // exactly the stock available, no more
      expect(rejected).toBe(10);

      const activeReservedSum = await prisma.stockReservation.aggregate({
        where: { inventoryItemId: itemId, status: "ACTIVE" },
        _sum: { quantity: true },
      });
      const item = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
      // The invariant the whole reservation system exists to guarantee:
      // active holds can never exceed committed stock.
      expect(new Prisma.Decimal(activeReservedSum._sum.quantity ?? 0).lessThanOrEqualTo(item.stockQuantity)).toBe(true);
      expect(activeReservedSum._sum.quantity?.toString()).toBe("1000");
    },
    20_000,
  );
});
