import { z } from "zod";
import { uuidSchema } from "./common.schema";

/**
 * `branchId` is required on every add — the cart is scoped to whichever
 * branch the first item came from (see CartService.addItem in the API),
 * and every subsequent add must match it or is rejected with a clear
 * "clear your cart first" error rather than silently switching branches.
 */
export const addCartItemSchema = z.object({
  branchId: uuidSchema,
  productId: uuidSchema,
  variantId: uuidSchema,
  quantity: z.number().int().positive().max(999),
  addonIds: z.array(uuidSchema).max(20).default([]),
  specialInstructions: z.string().trim().max(300).optional(),
});
export type AddCartItemDto = z.infer<typeof addCartItemSchema>;

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive().max(999).optional(),
  addonIds: z.array(uuidSchema).max(20).optional(),
  specialInstructions: z.string().trim().max(300).nullable().optional(),
});
export type UpdateCartItemDto = z.infer<typeof updateCartItemSchema>;
