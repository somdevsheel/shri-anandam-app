import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { PrismaService } from "../database/prisma.service";
import { CatalogService } from "./catalog.service";
import { NotFoundError } from "../common/errors/app.error";

/**
 * Real integration test against PostgreSQL — the public catalog's
 * visibility rules (branch-scoped availability, active-only, category
 * filtering) are exactly what stops an inactive or wrong-branch product
 * from being orderable, so they're worth verifying against a real query
 * plan rather than trusting the Prisma `where` clause reads correctly.
 */
describe("CatalogService (integration)", () => {
  const prisma = new PrismaClient();
  const catalog = new CatalogService(prisma as unknown as PrismaService);

  const suffix = randomUUID().slice(0, 8);
  const emptyQuery = { page: 1, pageSize: 20, sortOrder: "desc" as const };

  let organizationId: string;
  let branchAId: string;
  let branchBId: string;
  let categoryId: string;
  let visibleProductId: string;
  let inactiveProductId: string;
  let branchOnlyBProductId: string;

  beforeAll(async () => {
    const org = await prisma.organization.create({ data: { name: `Catalog Test Org ${suffix}` } });
    organizationId = org.id;

    const branchA = await prisma.branch.create({
      data: { organizationId, name: "Branch A", address: "A", code: `CAT-A-${suffix}` },
    });
    branchAId = branchA.id;
    const branchB = await prisma.branch.create({
      data: { organizationId, name: "Branch B", address: "B", code: `CAT-B-${suffix}` },
    });
    branchBId = branchB.id;

    const category = await prisma.category.create({
      data: { name: `Test Category ${suffix}`, slug: `test-category-${suffix}` },
    });
    categoryId = category.id;

    const visible = await prisma.product.create({
      data: {
        categoryId,
        name: `Visible Product ${suffix}`,
        slug: `visible-product-${suffix}`,
        branchProducts: { create: [{ branchId: branchAId }, { branchId: branchBId }] },
      },
    });
    visibleProductId = visible.id;

    const inactive = await prisma.product.create({
      data: {
        categoryId,
        name: `Inactive Product ${suffix}`,
        slug: `inactive-product-${suffix}`,
        isActive: false,
        branchProducts: { create: [{ branchId: branchAId }] },
      },
    });
    inactiveProductId = inactive.id;

    const branchOnlyB = await prisma.product.create({
      data: {
        categoryId,
        name: `Branch B Only ${suffix}`,
        slug: `branch-b-only-${suffix}`,
        branchProducts: { create: [{ branchId: branchBId }] },
      },
    });
    branchOnlyBProductId = branchOnlyB.id;
  });

  afterAll(async () => {
    await prisma.product.deleteMany({
      where: { id: { in: [visibleProductId, inactiveProductId, branchOnlyBProductId] } },
    });
    await prisma.category.delete({ where: { id: categoryId } });
    await prisma.branch.deleteMany({ where: { id: { in: [branchAId, branchBId] } } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it("excludes inactive products from listings regardless of branch", async () => {
    const result = await catalog.listProducts({ ...emptyQuery, categoryId });
    const names = result.items.map((p) => p.name);
    expect(names).toContain(`Visible Product ${suffix}`);
    expect(names).toContain(`Branch B Only ${suffix}`);
    expect(names).not.toContain(`Inactive Product ${suffix}`);
  });

  it("scopes listings to a branch when branchId is provided", async () => {
    const branchAResult = await catalog.listProducts({ ...emptyQuery, categoryId, branchId: branchAId });
    const branchANames = branchAResult.items.map((p) => p.name);
    expect(branchANames).toContain(`Visible Product ${suffix}`);
    expect(branchANames).not.toContain(`Branch B Only ${suffix}`); // not enabled at Branch A

    const branchBResult = await catalog.listProducts({ ...emptyQuery, categoryId, branchId: branchBId });
    const branchBNames = branchBResult.items.map((p) => p.name);
    expect(branchBNames).toContain(`Visible Product ${suffix}`);
    expect(branchBNames).toContain(`Branch B Only ${suffix}`);
  });

  it("resolves listings by categorySlug the same as categoryId", async () => {
    const bySlug = await catalog.listProducts({ ...emptyQuery, categorySlug: `test-category-${suffix}` });
    expect(bySlug.totalItems).toBe(2); // visible + branch-B-only, not inactive
  });

  it("404s a categorySlug that doesn't exist", async () => {
    await expect(catalog.listProducts({ ...emptyQuery, categorySlug: "does-not-exist" })).rejects.toThrow();
  });

  it("returns an active product by slug", async () => {
    const product = await catalog.getProductBySlug(`visible-product-${suffix}`);
    expect(product.name).toBe(`Visible Product ${suffix}`);
  });

  it("404s an inactive product by slug — deactivation actually hides it from customers", async () => {
    await expect(catalog.getProductBySlug(`inactive-product-${suffix}`)).rejects.toThrow(NotFoundError);
  });

  it("404s a slug that was never a product", async () => {
    await expect(catalog.getProductBySlug("no-such-slug-ever")).rejects.toThrow(NotFoundError);
  });
});
