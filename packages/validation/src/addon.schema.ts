import { z } from "zod";
import { paginationQuerySchema } from "./common.schema";

export const createAddonSchema = z.object({
  name: z.string().trim().min(1).max(150),
  priceInPaise: z.number().int().nonnegative(),
});
export type CreateAddonDto = z.infer<typeof createAddonSchema>;

export const updateAddonSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  priceInPaise: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateAddonDto = z.infer<typeof updateAddonSchema>;

export const listAddonsQuerySchema = paginationQuerySchema.extend({
  isActive: z.coerce.boolean().optional(),
  search: z.string().trim().max(150).optional(),
});
export type ListAddonsQueryDto = z.infer<typeof listAddonsQuerySchema>;
