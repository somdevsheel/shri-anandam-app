import { z } from "zod";
import { paginationQuerySchema, uuidSchema } from "./common.schema";

const inventoryUnitSchema = z.enum(["GRAM", "PIECE"]);

export const createInventoryItemSchema = z.object({
  branchId: uuidSchema,
  productVariantId: uuidSchema,
  unit: inventoryUnitSchema,
  initialQuantity: z.number().nonnegative().default(0),
  lowStockThreshold: z.number().nonnegative().default(0),
});
export type CreateInventoryItemDto = z.infer<typeof createInventoryItemSchema>;

export const updateInventoryThresholdSchema = z.object({
  lowStockThreshold: z.number().nonnegative(),
});
export type UpdateInventoryThresholdDto = z.infer<typeof updateInventoryThresholdSchema>;

export const restockInventorySchema = z.object({
  quantity: z.number().positive(),
  note: z.string().trim().max(300).optional(),
  /** When provided, also records a ProductionBatch alongside the restock. */
  batchCode: z.string().trim().toUpperCase().max(64).optional(),
  expiresAt: z.coerce.date().optional(),
});
export type RestockInventoryDto = z.infer<typeof restockInventorySchema>;

/**
 * Positive delta increases stock, negative decreases it — a signed
 * correction (e.g. recount found 200g more/less than the system
 * believed), distinct from restock (always adds) and wastage (always
 * subtracts with a spoilage/damage reason).
 */
export const adjustInventorySchema = z.object({
  quantityDelta: z.number().refine((v) => v !== 0, "quantityDelta must be non-zero"),
  reason: z.string().trim().min(1).max(300),
});
export type AdjustInventoryDto = z.infer<typeof adjustInventorySchema>;

export const recordWastageSchema = z.object({
  quantity: z.number().positive(),
  reason: z.string().trim().min(1).max(300),
});
export type RecordWastageDto = z.infer<typeof recordWastageSchema>;

export const listInventoryQuerySchema = paginationQuerySchema.extend({
  branchId: uuidSchema.optional(),
  productVariantId: uuidSchema.optional(),
  lowStockOnly: z.coerce.boolean().optional(),
  outOfStockOnly: z.coerce.boolean().optional(),
});
export type ListInventoryQueryDto = z.infer<typeof listInventoryQuerySchema>;

export const listInventoryTransactionsQuerySchema = paginationQuerySchema;
export type ListInventoryTransactionsQueryDto = z.infer<typeof listInventoryTransactionsQuerySchema>;

export const createProductionBatchSchema = z.object({
  branchId: uuidSchema,
  productVariantId: uuidSchema,
  batchCode: z.string().trim().toUpperCase().min(1).max(64),
  quantityProduced: z.number().positive(),
  expiresAt: z.coerce.date().optional(),
});
export type CreateProductionBatchDto = z.infer<typeof createProductionBatchSchema>;

export const listProductionBatchesQuerySchema = paginationQuerySchema.extend({
  branchId: uuidSchema.optional(),
  productVariantId: uuidSchema.optional(),
});
export type ListProductionBatchesQueryDto = z.infer<typeof listProductionBatchesQuerySchema>;
