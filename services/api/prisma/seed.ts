/**
 * Idempotent database seed: RBAC roles/permissions, a default
 * Organization + Branch, an initial 14-category catalog structure (real
 * business categories, not test data — see seedCatalog's own comment for
 * why this runs in every environment including production), and (in
 * non-production only) a bootstrap OWNER staff account so there is a way
 * to log into the admin panel on a fresh database. Run via `pnpm prisma:seed`.
 */
import { PrismaClient, ProductUnit } from "@prisma/client";
import * as argon2 from "argon2";
import { DEFAULT_ROLE_PERMISSIONS, Permission, Role } from "@shri-anandam/shared-types";

const prisma = new PrismaClient();

async function seedPermissions() {
  for (const key of Object.values(Permission)) {
    await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  }
}

async function seedRoles() {
  for (const roleName of Object.values(Role)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });

    const permissionKeys = DEFAULT_ROLE_PERMISSIONS[roleName];
    for (const key of permissionKeys) {
      const permission = await prisma.permission.findUniqueOrThrow({ where: { key } });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }
}

async function seedOrganization() {
  const existing = await prisma.organization.findFirst();
  if (existing) return existing;

  return prisma.organization.create({
    data: {
      name: "Shri Anandam Sweets & Restaurant",
      branches: {
        create: {
          name: "Main Branch",
          code: "SA-MAIN",
          address: "Configure the real address in the admin panel",
        },
      },
    },
  });
}

/**
 * The 14 top-level categories the restaurant actually sells under —
 * real business data, not fake/test rows, which is why this runs in
 * every environment (including production) unlike seedBootstrapOwner
 * below. Idempotent by slug: create-if-missing only (`update: {}`),
 * so re-running this after the owner has renamed/reordered/deactivated
 * a category never overwrites what they did — "kept separate from the
 * production catalog" means the seed only ever *initializes*, it never
 * re-asserts itself over live admin edits.
 *
 * Only 2 categories (Momos, Sweets) get an example product — the brief
 * this was built from gave real prices for exactly those two products'
 * variants and explicitly said not to invent prices for anything else,
 * so the other 12 categories are seeded empty, ready for the owner to
 * populate from the admin panel.
 */
async function seedCatalog() {
  const categories = [
    { name: "Sweets", slug: "sweets" },
    { name: "Namkeen", slug: "namkeen" },
    { name: "Momos", slug: "momos" },
    { name: "Starters", slug: "starters" },
    { name: "Chaat", slug: "chaat" },
    { name: "North Indian", slug: "north-indian" },
    { name: "Rice / Biryani", slug: "rice-biryani" },
    { name: "Breads", slug: "breads" },
    { name: "Thali / Combos", slug: "thali-combos" },
    { name: "Drinks", slug: "drinks" },
    { name: "Desserts", slug: "desserts" },
    { name: "Bakery", slug: "bakery" },
    { name: "Combos / Special Offers", slug: "combos-special-offers" },
    { name: "Gift Packs", slug: "gift-packs" },
  ];

  const categoryIdBySlug = new Map<string, string>();
  for (const [index, category] of categories.entries()) {
    const row = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {},
      create: { name: category.name, slug: category.slug, sortOrder: index },
    });
    categoryIdBySlug.set(category.slug, row.id);
  }

  // Assign to whatever branch exists (seedOrganization's Main Branch on a
  // fresh install) so the seeded products are actually orderable, not
  // just present — a product with no BranchProduct row is invisible to
  // ordering regardless of isActive (see docs/deployment's own note on
  // this exact gotcha, hit live once already this project).
  const branch = await prisma.branch.findFirst();

  async function seedExampleProduct(params: {
    categorySlug: string;
    name: string;
    slug: string;
    variants: { name: string; sku: string; unit: ProductUnit; quantity: number; weightGrams?: number; priceInPaise: number | null }[];
  }) {
    const categoryId = categoryIdBySlug.get(params.categorySlug);
    if (!categoryId) return;

    const product = await prisma.product.upsert({
      where: { slug: params.slug },
      update: {},
      create: { categoryId, name: params.name, slug: params.slug, isActive: true },
    });

    for (const variant of params.variants) {
      await prisma.productVariant.upsert({
        where: { sku: variant.sku },
        update: {},
        create: {
          productId: product.id,
          name: variant.name,
          sku: variant.sku,
          unit: variant.unit,
          quantity: variant.quantity,
          weightGrams: variant.weightGrams,
          priceInPaise: variant.priceInPaise,
        },
      });
    }

    if (branch) {
      await prisma.branchProduct.upsert({
        where: { branchId_productId: { branchId: branch.id, productId: product.id } },
        update: {},
        create: { branchId: branch.id, productId: product.id },
      });
    }
  }

  await seedExampleProduct({
    categorySlug: "momos",
    name: "Veg Momos",
    slug: "veg-momos",
    variants: [
      { name: "Half Plate", sku: "MOMO-VEG-HALF", unit: ProductUnit.HALF_PLATE, quantity: 1, priceInPaise: 6000 },
      { name: "Full Plate", sku: "MOMO-VEG-FULL", unit: ProductUnit.FULL_PLATE, quantity: 1, priceInPaise: 12000 },
    ],
  });

  await seedExampleProduct({
    categorySlug: "sweets",
    name: "Rasgulla",
    slug: "rasgulla",
    variants: [
      // 250g/500g: real Shri Anandam price not provided — left as "TBD"
      // (null) per instruction, not invented. 1kg's ₹300 was given.
      { name: "250g", sku: "SWT-RASGULLA-250G", unit: ProductUnit.GRAM, quantity: 250, weightGrams: 250, priceInPaise: null },
      { name: "500g", sku: "SWT-RASGULLA-500G", unit: ProductUnit.GRAM, quantity: 500, weightGrams: 500, priceInPaise: null },
      { name: "1kg", sku: "SWT-RASGULLA-1KG", unit: ProductUnit.KILOGRAM, quantity: 1, weightGrams: 1000, priceInPaise: 30000 },
    ],
  });
}

async function seedBootstrapOwner() {
  if (process.env.NODE_ENV === "production") {
    console.log("Skipping bootstrap OWNER seed in production — create the first OWNER manually.");
    return;
  }

  const email = process.env.SEED_OWNER_EMAIL ?? "owner@shrianandam.local";
  const password = process.env.SEED_OWNER_PASSWORD ?? "ChangeMe123!";

  const existing = await prisma.staff.findUnique({ where: { email } });
  if (existing) return;

  const ownerRole = await prisma.role.findUniqueOrThrow({ where: { name: Role.OWNER } });
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  await prisma.staff.create({
    data: {
      email,
      passwordHash,
      name: "Owner",
      staffRoles: { create: { roleId: ownerRole.id } },
    },
  });

  console.log(`Seeded bootstrap OWNER account: ${email} / ${password} — CHANGE THIS PASSWORD IMMEDIATELY.`);
}

async function main() {
  await seedPermissions();
  await seedRoles();
  await seedOrganization();
  await seedCatalog();
  await seedBootstrapOwner();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
