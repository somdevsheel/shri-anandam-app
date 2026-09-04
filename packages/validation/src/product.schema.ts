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

export const createProductVariantSchema = z.object({
  name: z.string().trim().min(1).max(100),
  sku: z.string().trim().toUpperCase().min(1).max(64),
  weightGrams: z.number().positive().max(1_000_000).optional(),
  priceInPaise: z.number().int().positive(),
  compareAtPriceInPaise: z.number().int().positive().optional(),
});
export type CreateProductVariantDto = z.infer<typeof createProductVariantSchema>;

export const updateProductVariantSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  weightGrams: z.number().positive().max(1_000_000).nullable().optional(),
  priceInPaise: z.number().int().positive().optional(),
  compareAtPriceInPaise: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  /** Optional note recorded on the PriceHistory/audit-log entry when priceInPaise changes. */
  priceChangeReason: z.string().trim().max(300).optional(),
});
export type UpdateProductVariantDto = z.infer<typeof updateProductVariantSchema>;

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
