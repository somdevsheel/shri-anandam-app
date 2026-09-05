import { z } from "zod";
import { paginationQuerySchema, uuidSchema } from "./common.schema";

// ---------------------------------------------------------------------------
// Product
// ---------------------------------------------------------------------------

export const createProductSchema = z.object({
  categoryId: uuidSchema,
  name: z.string().trim().min(1).max(200),
  /** Auto-generated from name server-side when omitted. */
  slug: z.string().trim().toLowerCase().max(220).optional(),
  description: z.string().trim().max(5000).optional(),
  ingredients: z.string().trim().max(2000).optional(),
  allergens: z.array(z.string().trim().toLowerCase().max(50)).default([]),
  nutritionalInfo: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  tags: z.array(z.string().trim().toLowerCase().max(50)).max(30).default([]),
  isFeatured: z.boolean().default(false),
  isVeg: z.boolean().default(true),
});
export type CreateProductDto = z.infer<typeof createProductSchema>;

export const updateProductSchema = z.object({
  categoryId: uuidSchema.optional(),
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  ingredients: z.string().trim().max(2000).nullable().optional(),
  allergens: z.array(z.string().trim().toLowerCase().max(50)).optional(),
  nutritionalInfo: z.record(z.string(), z.union([z.string(), z.number()])).nullable().optional(),
  tags: z.array(z.string().trim().toLowerCase().max(50)).max(30).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  isVeg: z.boolean().optional(),
});
export type UpdateProductDto = z.infer<typeof updateProductSchema>;

/** Admin product list — every product regardless of active/branch status. */
export const listProductsAdminQuerySchema = paginationQuerySchema.extend({
  categoryId: uuidSchema.optional(),
  isActive: z.coerce.boolean().optional(),
  isFeatured: z.coerce.boolean().optional(),
  search: z.string().trim().max(150).optional(),
});
export type ListProductsAdminQueryDto = z.infer<typeof listProductsAdminQuerySchema>;

/**
 * Public catalog browsing. Deliberately does NOT support price sort/filter
 * yet — a product's price is really a range across its variants, and
 * sorting a paginated list by that requires either a denormalized
 * min-price column or a search index; both are natural additions when
 * search moves to OpenSearch (section 51), not before. See
 * docs/architecture/decisions.md.
 */
export const browseCatalogProductsQuerySchema = paginationQuerySchema.extend({
  categoryId: uuidSchema.optional(),
  categorySlug: z.string().trim().toLowerCase().max(180).optional(),
  branchId: uuidSchema.optional(),
  isFeatured: z.coerce.boolean().optional(),
  tag: z.string().trim().toLowerCase().max(50).optional(),
  search: z.string().trim().max(150).optional(),
});
export type BrowseCatalogProductsQueryDto = z.infer<typeof browseCatalogProductsQuerySchema>;

// ---------------------------------------------------------------------------
// Variant
// ---------------------------------------------------------------------------

/** Selling unit — see ProductVariant.unit's own schema comment for why
 * this is separate from inventory.schema.ts's inventoryUnitSchema. */
export const productUnitSchema = z.enum([
  "PIECE",
  "PLATE",
  "HALF_PLATE",
  "FULL_PLATE",
  "GRAM",
  "KILOGRAM",
  "ML",
  "LITRE",
  "BOX",
  "PACKET",
]);
export type ProductUnit = z.infer<typeof productUnitSchema>;

export const createProductVariantSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    sku: z.string().trim().toUpperCase().min(1).max(64),
    weightGrams: z.number().positive().max(1_000_000).optional(),
    unit: productUnitSchema.default("PIECE"),
    quantity: z.number().positive().max(1_000_000).default(1),
    /** Omit (or null) to leave the price "TBD" — see ProductVariant.priceInPaise's
     * own schema comment. Never invent a price; leave it unset until
     * the real one is known. */
    priceInPaise: z.number().int().positive().optional(),
    compareAtPriceInPaise: z.number().int().positive().optional(),
    /** GST rate as a percentage, e.g. 5 for 5%. */
    gstRatePercent: z.number().min(0).max(100).optional(),
    minOrderQuantity: z.number().int().positive().default(1),
    maxOrderQuantity: z.number().int().positive().optional(),
  })
  .refine((v) => v.maxOrderQuantity === undefined || v.maxOrderQuantity >= v.minOrderQuantity, {
    message: "maxOrderQuantity must be greater than or equal to minOrderQuantity",
    path: ["maxOrderQuantity"],
  });
export type CreateProductVariantDto = z.infer<typeof createProductVariantSchema>;

export const updateProductVariantSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    weightGrams: z.number().positive().max(1_000_000).nullable().optional(),
    unit: productUnitSchema.optional(),
    quantity: z.number().positive().max(1_000_000).optional(),
    /** Explicit null clears the price back to "TBD"; omit to leave unchanged. */
    priceInPaise: z.number().int().positive().nullable().optional(),
    compareAtPriceInPaise: z.number().int().positive().nullable().optional(),
    gstRatePercent: z.number().min(0).max(100).nullable().optional(),
    minOrderQuantity: z.number().int().positive().optional(),
    maxOrderQuantity: z.number().int().positive().nullable().optional(),
    isActive: z.boolean().optional(),
    /** Optional note recorded on the PriceHistory/audit-log entry when priceInPaise changes. */
    priceChangeReason: z.string().trim().max(300).optional(),
  })
  .refine(
    (v) => v.maxOrderQuantity == null || v.minOrderQuantity == null || v.maxOrderQuantity >= v.minOrderQuantity,
    { message: "maxOrderQuantity must be greater than or equal to minOrderQuantity", path: ["maxOrderQuantity"] },
  );
export type UpdateProductVariantDto = z.infer<typeof updateProductVariantSchema>;

// ---------------------------------------------------------------------------
// Variant <-> Branch assignment (replace-set pattern, mirrors assignProductBranchesSchema)
// ---------------------------------------------------------------------------

export const assignVariantBranchesSchema = z.object({
  branchIds: z.array(uuidSchema),
});
export type AssignVariantBranchesDto = z.infer<typeof assignVariantBranchesSchema>;

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

export const createProductImageSchema = z.object({
  url: z.string().url(),
  altText: z.string().trim().max(200).optional(),
  sortOrder: z.number().int().default(0),
});
export type CreateProductImageDto = z.infer<typeof createProductImageSchema>;

// ---------------------------------------------------------------------------
// Product <-> Addon / Product <-> Branch assignment (replace-set pattern)
// ---------------------------------------------------------------------------

export const assignProductAddonsSchema = z.object({
  addonIds: z.array(uuidSchema),
});
export type AssignProductAddonsDto = z.infer<typeof assignProductAddonsSchema>;

export const assignProductBranchesSchema = z.object({
  branchIds: z.array(uuidSchema),
});
export type AssignProductBranchesDto = z.infer<typeof assignProductBranchesSchema>;
