import { z } from "zod";
import { paginationQuerySchema, uuidSchema } from "./common.schema";

export const createCategorySchema = z.object({
  name: z.string().trim().min(1).max(150),
  /** Auto-generated from name server-side when omitted. */
  slug: z.string().trim().toLowerCase().max(180).optional(),
  parentId: uuidSchema.optional(),
  imageUrl: z.string().url().optional(),
  sortOrder: z.number().int().default(0),
});
export type CreateCategoryDto = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  parentId: uuidSchema.nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;

export const listCategoriesQuerySchema = paginationQuerySchema.extend({
  isActive: z.coerce.boolean().optional(),
  parentId: uuidSchema.optional(),
  search: z.string().trim().max(150).optional(),
});
export type ListCategoriesQueryDto = z.infer<typeof listCategoriesQuerySchema>;
