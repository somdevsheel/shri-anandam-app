import { z } from "zod";
import { paginationQuerySchema, uuidSchema } from "./common.schema";

/** A PIN code as stored/matched against exactly — DeliveryFeeService does a plain array-includes check, no normalization beyond this. */
const pincodeSchema = z.string().trim().regex(/^\d{6}$/, "PIN code must be 6 digits");

export const createDeliveryZoneSchema = z.object({
  branchId: uuidSchema,
  name: z.string().trim().min(1).max(150),
  pincodes: z.array(pincodeSchema).min(1, "Cover at least one PIN code"),
  minOrderInPaise: z.number().int().nonnegative().default(0),
  deliveryFeeInPaise: z.number().int().nonnegative(),
  freeDeliveryThresholdInPaise: z.number().int().positive().optional(),
});
export type CreateDeliveryZoneDto = z.infer<typeof createDeliveryZoneSchema>;

export const updateDeliveryZoneSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  pincodes: z.array(pincodeSchema).min(1).optional(),
  minOrderInPaise: z.number().int().nonnegative().optional(),
  deliveryFeeInPaise: z.number().int().nonnegative().optional(),
  freeDeliveryThresholdInPaise: z.number().int().positive().nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateDeliveryZoneDto = z.infer<typeof updateDeliveryZoneSchema>;

export const listDeliveryZonesQuerySchema = paginationQuerySchema.extend({
  branchId: uuidSchema.optional(),
  isActive: z.coerce.boolean().optional(),
});
export type ListDeliveryZonesQueryDto = z.infer<typeof listDeliveryZonesQuerySchema>;
