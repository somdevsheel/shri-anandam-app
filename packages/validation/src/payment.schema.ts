import { z } from "zod";
import { uuidSchema } from "./common.schema";

/** Staff recording an offline collection (COD at delivery, cash/UPI at the counter) against an existing PENDING payment — section 15. */
export const collectPaymentSchema = z.object({
  amountInPaise: z.number().int().positive().optional(), // defaults to the payment's full amountInPaise if omitted
  referenceNumber: z.string().trim().max(100).optional(), // UPI UTR / transaction ref, if any
  notes: z.string().trim().max(300).optional(),
});
export type CollectPaymentDto = z.infer<typeof collectPaymentSchema>;

/** Staff adding an ADDITIONAL payment method/amount to an order (section 16 — split payments, e.g. ₹500 online + ₹1000 cash). */
export const addManualPaymentSchema = z.object({
  method: z.enum(["COD", "PAY_AT_STORE", "DIRECT_UPI"]),
  amountInPaise: z.number().int().positive(),
  referenceNumber: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(300).optional(),
});
export type AddManualPaymentDto = z.infer<typeof addManualPaymentSchema>;

export const createRefundSchema = z.object({
  amountInPaise: z.number().int().positive(),
  reason: z.string().trim().min(1).max(300),
});
export type CreateRefundDto = z.infer<typeof createRefundSchema>;

export const reconciliationQuerySchema = z.object({
  branchId: uuidSchema.optional(),
  dateFrom: z.coerce.date(),
  dateTo: z.coerce.date(),
});
export type ReconciliationQueryDto = z.infer<typeof reconciliationQuerySchema>;
