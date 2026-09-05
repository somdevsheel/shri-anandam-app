import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import { AuditLogService } from "../audit/audit-log.service";
import { ConflictError, NotFoundError, ValidationError } from "../common/errors/app.error";
import { paginate } from "../common/util/paginate";
import { ensureUniqueSlug } from "../common/util/unique-slug";
import { S3UploadService } from "../uploads/s3-upload.service";
import type { AuthenticatedStaff } from "../auth/types/authenticated-user.type";
import type {
  AssignProductAddonsDto,
  AssignProductBranchesDto,
  AssignVariantBranchesDto,
  CreateProductDto,
  CreateProductImageDto,
  CreateProductVariantDto,
  ListProductsAdminQueryDto,
  UpdateProductDto,
  UpdateProductVariantDto,
} from "@shri-anandam/validation";

interface RequestContext {
  ipAddress?: string;
  userAgent?: string;
}

const PRODUCT_DETAIL_INCLUDE = {
  category: true,
  variants: {
    orderBy: { priceInPaise: "asc" },
    include: { branchVariants: { include: { branch: true } } },
  },
  images: { orderBy: { sortOrder: "asc" } },
  productAddons: { include: { addon: true } },
  branchProducts: { include: { branch: true } },
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly s3: S3UploadService,
  ) {}

  // ---------------------------------------------------------------------
  // Product
  // ---------------------------------------------------------------------

  async list(query: ListProductsAdminQueryDto) {
    const where: Prisma.ProductWhereInput = {
      categoryId: query.categoryId,
      isActive: query.isActive,
      isFeatured: query.isFeatured,
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
            orderBy: { createdAt: "desc" },
            include: PRODUCT_DETAIL_INCLUDE,
          }),
          this.prisma.product.count({ where }),
        ]),
    );
  }

  async getById(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: PRODUCT_DETAIL_INCLUDE });
    if (!product) throw new NotFoundError("Product", id);
    return product;
  }

  async create(dto: CreateProductDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
    if (!category) {
      throw new ValidationError("Category does not exist", [{ field: "categoryId", message: "Unknown category" }]);
    }

    const slug = await ensureUniqueSlug(
      dto.slug,
      dto.name,
      async (candidate) => (await this.prisma.product.count({ where: { slug: candidate } })) > 0,
    );

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          categoryId: dto.categoryId,
          name: dto.name,
          slug,
          description: dto.description,
          ingredients: dto.ingredients,
          allergens: dto.allergens,
          nutritionalInfo: dto.nutritionalInfo,
          tags: dto.tags,
          isFeatured: dto.isFeatured,
          isVeg: dto.isVeg,
        },
        include: PRODUCT_DETAIL_INCLUDE,
      });

      await this.auditLog.record(
        {
          actor,
          action: "PRODUCT_CREATED",
          entityType: "Product",
          entityId: product.id,
          newValue: { name: product.name, slug: product.slug, categoryId: product.categoryId },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return product;
    });
  }

  async update(id: string, dto: UpdateProductDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    const existing = await this.getById(id);

    if (dto.categoryId) {
      const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!category) {
        throw new ValidationError("Category does not exist", [{ field: "categoryId", message: "Unknown category" }]);
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        // Explicit field list (not `data: dto`) — Prisma's checked
        // ProductUpdateInput models the category relation via `category:
        // { connect }`, not a raw `categoryId` scalar, so passing dto
        // through unchanged doesn't typecheck against it.
        data: {
          categoryId: dto.categoryId,
          name: dto.name,
          description: dto.description,
          ingredients: dto.ingredients,
          allergens: dto.allergens,
          // A DTO value of `null` means "clear it" and must become
          // Prisma.JsonNull (the SQL NULL marker for Json columns) rather
          // than JS `undefined`, which Prisma instead reads as "leave
          // this field alone."
          nutritionalInfo: dto.nutritionalInfo === null ? Prisma.JsonNull : dto.nutritionalInfo,
          tags: dto.tags,
          isActive: dto.isActive,
          isFeatured: dto.isFeatured,
          isVeg: dto.isVeg,
        },
        include: PRODUCT_DETAIL_INCLUDE,
      });

      await this.auditLog.record(
        {
          actor,
          action: "PRODUCT_UPDATED",
          entityType: "Product",
          entityId: product.id,
          oldValue: { name: existing.name, categoryId: existing.categoryId, isActive: existing.isActive },
          newValue: { name: product.name, categoryId: product.categoryId, isActive: product.isActive },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return product;
    });
  }

  /** section 34/45: "Product deletion" is explicitly a sensitive audited action — and never a hard delete (order_items references it). */
  async deactivate(id: string, actor: AuthenticatedStaff, ctx: RequestContext) {
    const existing = await this.getById(id);
    if (!existing.isActive) return existing;

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.update({
        where: { id },
        data: { isActive: false },
        include: PRODUCT_DETAIL_INCLUDE,
      });

      await this.auditLog.record(
        {
          actor,
          action: "PRODUCT_DEACTIVATED",
          entityType: "Product",
          entityId: product.id,
          oldValue: { isActive: true },
          newValue: { isActive: false },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return product;
    });
  }

  // ---------------------------------------------------------------------
  // Variants
  // ---------------------------------------------------------------------

  async addVariant(productId: string, dto: CreateProductVariantDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    await this.getById(productId);

    const skuTaken = await this.prisma.productVariant.findUnique({ where: { sku: dto.sku } });
    if (skuTaken) {
      throw new ConflictError(`SKU "${dto.sku}" is already in use`);
    }

    return this.prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.create({
        data: {
          productId,
          name: dto.name,
          sku: dto.sku,
          weightGrams: dto.weightGrams,
          unit: dto.unit,
          quantity: dto.quantity,
          priceInPaise: dto.priceInPaise,
          compareAtPriceInPaise: dto.compareAtPriceInPaise,
          gstRatePercent: dto.gstRatePercent,
          minOrderQuantity: dto.minOrderQuantity,
          maxOrderQuantity: dto.maxOrderQuantity,
        },
      });

      await this.auditLog.record(
        {
          actor,
          action: "PRODUCT_VARIANT_CREATED",
          entityType: "ProductVariant",
          entityId: variant.id,
          newValue: variant,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return variant;
    });
  }

  async updateVariant(
    productId: string,
    variantId: string,
    dto: UpdateProductVariantDto,
    actor: AuthenticatedStaff,
    ctx: RequestContext,
  ) {
    const existing = await this.getVariantOrThrow(productId, variantId);
    const priceChanged = dto.priceInPaise !== undefined && dto.priceInPaise !== existing.priceInPaise;

    return this.prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.update({
        where: { id: variantId },
        data: {
          name: dto.name,
          weightGrams: dto.weightGrams,
          unit: dto.unit,
          quantity: dto.quantity,
          priceInPaise: dto.priceInPaise,
          compareAtPriceInPaise: dto.compareAtPriceInPaise,
          gstRatePercent: dto.gstRatePercent,
          minOrderQuantity: dto.minOrderQuantity,
          maxOrderQuantity: dto.maxOrderQuantity,
          isActive: dto.isActive,
        },
      });

      if (priceChanged) {
        // section 10/45: every price change is recorded twice — once in
        // PriceHistory (product-scoped, drives a "price history" view on
        // this specific variant) and once in the general AuditLog (drives
        // the org-wide "sensitive actions" audit trail). Both are
        // populated from the same transaction so they can never disagree.
        //
        // PriceHistory's columns are non-null Ints — a real number-to-
        // number change. A transition to/from "TBD" (null) is a
        // different kind of event ("price set"/"price unset", not "price
        // moved from ₹X to ₹Y") and isn't written here, only to the
        // AuditLog below, which fires unconditionally either way.
        if (existing.priceInPaise !== null && variant.priceInPaise !== null) {
          await tx.priceHistory.create({
            data: {
              variantId,
              oldPriceInPaise: existing.priceInPaise,
              newPriceInPaise: variant.priceInPaise,
              changedByStaffId: actor.id,
              reason: dto.priceChangeReason,
            },
          });
        }

        await this.auditLog.record(
          {
            actor,
            action: "PRODUCT_VARIANT_PRICE_CHANGED",
            entityType: "ProductVariant",
            entityId: variant.id,
            oldValue: { priceInPaise: existing.priceInPaise },
            newValue: { priceInPaise: variant.priceInPaise, reason: dto.priceChangeReason },
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
          },
          tx,
        );
      }

      return variant;
    });
  }

  /** Variants are referenced by order items/inventory once sold — deactivate, never hard-delete. */
  async removeVariant(productId: string, variantId: string, actor: AuthenticatedStaff, ctx: RequestContext) {
    const existing = await this.getVariantOrThrow(productId, variantId);
    if (!existing.isActive) return existing;

    return this.prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.update({ where: { id: variantId }, data: { isActive: false } });

      await this.auditLog.record(
        {
          actor,
          action: "PRODUCT_VARIANT_DEACTIVATED",
          entityType: "ProductVariant",
          entityId: variant.id,
          oldValue: { isActive: true },
          newValue: { isActive: false },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return variant;
    });
  }

  private async getVariantOrThrow(productId: string, variantId: string) {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant || variant.productId !== productId) {
      throw new NotFoundError("ProductVariant", variantId);
    }
    return variant;
  }

  // ---------------------------------------------------------------------
  // Images
  // ---------------------------------------------------------------------

  async addImage(productId: string, dto: CreateProductImageDto) {
    await this.getById(productId);
    return this.prisma.productImage.create({
      data: { productId, url: dto.url, altText: dto.altText, sortOrder: dto.sortOrder },
    });
  }

  async removeImage(productId: string, imageId: string) {
    const image = await this.prisma.productImage.findUnique({ where: { id: imageId } });
    if (!image || image.productId !== productId) {
      throw new NotFoundError("ProductImage", imageId);
    }
    await this.prisma.productImage.delete({ where: { id: imageId } });
    // Best-effort — the DB row is already gone regardless of whether this
    // succeeds (see deleteIfOwnedByUs's own comment for why it never
    // throws and why it no-ops for URLs this service didn't generate).
    await this.s3.deleteIfOwnedByUs(image.url);
  }

  // ---------------------------------------------------------------------
  // Addon / branch assignment (replace-set pattern)
  // ---------------------------------------------------------------------

  async assignAddons(productId: string, dto: AssignProductAddonsDto, actor: AuthenticatedStaff, ctx: RequestContext) {
    const product = await this.getById(productId);

    const addons = await this.prisma.addon.findMany({ where: { id: { in: dto.addonIds } } });
    const resolvedIds = new Set(addons.map((a) => a.id));
    const missing = dto.addonIds.filter((id) => !resolvedIds.has(id));
    if (missing.length > 0) {
      throw new ValidationError(
        "One or more addons do not exist",
        missing.map((id) => ({ field: "addonIds", message: `Unknown addon: ${id}` })),
      );
    }

    const oldAddonIds = product.productAddons.map((pa) => pa.addonId);

    return this.prisma.$transaction(async (tx) => {
      await tx.productAddon.deleteMany({ where: { productId } });
      await tx.productAddon.createMany({ data: dto.addonIds.map((addonId) => ({ productId, addonId })) });

      await this.auditLog.record(
        {
          actor,
          action: "PRODUCT_ADDONS_UPDATED",
          entityType: "Product",
          entityId: productId,
          oldValue: { addonIds: oldAddonIds },
          newValue: { addonIds: dto.addonIds },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return tx.product.findUniqueOrThrow({ where: { id: productId }, include: PRODUCT_DETAIL_INCLUDE });
    });
  }

  async assignBranches(
    productId: string,
    dto: AssignProductBranchesDto,
    actor: AuthenticatedStaff,
    ctx: RequestContext,
  ) {
    const product = await this.getById(productId);

    const branches = await this.prisma.branch.findMany({ where: { id: { in: dto.branchIds } } });
    const resolvedIds = new Set(branches.map((b) => b.id));
    const missing = dto.branchIds.filter((id) => !resolvedIds.has(id));
    if (missing.length > 0) {
      throw new ValidationError(
        "One or more branches do not exist",
        missing.map((id) => ({ field: "branchIds", message: `Unknown branch: ${id}` })),
      );
    }

    const oldBranchIds = product.branchProducts.map((bp) => bp.branchId);

    return this.prisma.$transaction(async (tx) => {
      await tx.branchProduct.deleteMany({ where: { productId } });
      await tx.branchProduct.createMany({ data: dto.branchIds.map((branchId) => ({ productId, branchId })) });

      await this.auditLog.record(
        {
          actor,
          action: "PRODUCT_BRANCHES_UPDATED",
          entityType: "Product",
          entityId: productId,
          oldValue: { branchIds: oldBranchIds },
          newValue: { branchIds: dto.branchIds },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return tx.product.findUniqueOrThrow({ where: { id: productId }, include: PRODUCT_DETAIL_INCLUDE });
    });
  }

  /** Same replace-set pattern as assignBranches, but per-variant — see
   * BranchProductVariant's own schema comment for why this exists
   * separately from product-level branch assignment. */
  async assignVariantBranches(
    productId: string,
    variantId: string,
    dto: AssignVariantBranchesDto,
    actor: AuthenticatedStaff,
    ctx: RequestContext,
  ) {
    await this.getVariantOrThrow(productId, variantId);

    const branches = await this.prisma.branch.findMany({ where: { id: { in: dto.branchIds } } });
    const resolvedIds = new Set(branches.map((b) => b.id));
    const missing = dto.branchIds.filter((id) => !resolvedIds.has(id));
    if (missing.length > 0) {
      throw new ValidationError(
        "One or more branches do not exist",
        missing.map((id) => ({ field: "branchIds", message: `Unknown branch: ${id}` })),
      );
    }

    const existingAssignments = await this.prisma.branchProductVariant.findMany({ where: { productVariantId: variantId } });
    const oldBranchIds = existingAssignments.map((bv) => bv.branchId);

    return this.prisma.$transaction(async (tx) => {
      await tx.branchProductVariant.deleteMany({ where: { productVariantId: variantId } });
      await tx.branchProductVariant.createMany({
        data: dto.branchIds.map((branchId) => ({ productVariantId: variantId, branchId })),
      });

      await this.auditLog.record(
        {
          actor,
          action: "PRODUCT_VARIANT_BRANCHES_UPDATED",
          entityType: "ProductVariant",
          entityId: variantId,
          oldValue: { branchIds: oldBranchIds },
          newValue: { branchIds: dto.branchIds },
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent,
        },
        tx,
      );

      return tx.product.findUniqueOrThrow({ where: { id: productId }, include: PRODUCT_DETAIL_INCLUDE });
    });
  }
}
