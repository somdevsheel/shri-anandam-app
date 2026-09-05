import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { NotFoundError, ValidationError } from "../common/errors/app.error";
import { paginate } from "../common/util/paginate";
import type { BrowseCatalogProductsQueryDto } from "@shri-anandam/validation";

const PUBLIC_PRODUCT_INCLUDE = {
  category: true,
  variants: { where: { isActive: true }, orderBy: { priceInPaise: "asc" } },
  images: { orderBy: { sortOrder: "asc" } },
  productAddons: { where: { addon: { isActive: true } }, include: { addon: true } },
  // The client needs to know which branch(es) actually carry this
  // product to add it to cart (Cart is branch-scoped — see
  // cart.service.ts) or show "not available near you." Full delivery-
  // zone/pincode-based branch resolution is Phase 6 (checkout) scope;
  // for browsing, every branch that stocks it is a valid choice.
  branchProducts: { where: { isActive: true }, include: { branch: true } },
} satisfies Prisma.ProductInclude;

/**
 * Public, unauthenticated catalog browsing (section 5/6 — Home,
 * Categories, Product Listing, Product Details). Everything here is
 * read-only and scoped to isActive rows only; admin management of the
 * same entities lives in src/categories, src/products, src/addons.
 * Pricing/availability shown here is for browsing only — checkout
 * (Phase 6) always re-validates server-side rather than trusting what a
 * client cached from these responses (section 6/72).
 */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listCategories() {
    return this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  /**
   * Public branch contact info for the customer app's Help & Support
   * screen — deliberately a narrow projection (name/phone/address only),
   * not the full Branch row `/branches` (staff-only, BRANCH_READ) returns,
   * which also carries organizationId and other internal fields a
   * customer has no reason to see.
   */
  listBranches() {
    return this.prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true, phone: true, address: true },
      orderBy: { name: "asc" },
    });
  }

  async listProducts(query: BrowseCatalogProductsQueryDto) {
    let categoryId = query.categoryId;
    if (!categoryId && query.categorySlug) {
      const category = await this.prisma.category.findUnique({ where: { slug: query.categorySlug } });
      if (!category || !category.isActive) {
        throw new ValidationError("Unknown category", [{ field: "categorySlug", message: "Category not found" }]);
      }
      categoryId = category.id;
    }

    const where: Prisma.ProductWhereInput = {
      isActive: true,
      categoryId,
      isFeatured: query.isFeatured,
      ...(query.tag ? { tags: { has: query.tag } } : {}),
      ...(query.branchId ? { branchProducts: { some: { branchId: query.branchId, isActive: true } } } : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: "insensitive" } },
              { description: { contains: query.search, mode: "insensitive" } },
              { tags: { has: query.search.toLowerCase() } },
            ],
          }
        : {}),
    };

    return paginate(
      { page: query.page, pageSize: query.pageSize, sortBy: query.sortBy ?? "", sortOrder: query.sortOrder },
      ({ skip, take }) =>
        this.prisma.$transaction([
          this.prisma.product.findMany({
            where,
            skip,
            take,
            orderBy: query.sortBy === "name" ? { name: query.sortOrder } : { createdAt: "desc" },
            include: PUBLIC_PRODUCT_INCLUDE,
          }),
          this.prisma.product.count({ where }),
        ]),
    );
  }

  async getProductBySlug(slug: string) {
    const product = await this.prisma.product.findUnique({ where: { slug }, include: PUBLIC_PRODUCT_INCLUDE });
    if (!product || !product.isActive) {
      throw new NotFoundError("Product", slug);
    }
    return product;
  }
}
