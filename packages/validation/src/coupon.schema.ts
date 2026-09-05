import { z } from "zod";
import { paginationQuerySchema, uuidSchema } from "./common.schema";

/**
 * Mirrors the `CouponType` enum in services/api/prisma/schema.prisma —
 * kept as a local literal union rather than a shared-types constant,
 * the same way order.schema.ts's `FulfillmentType` is: it's only ever
 * consumed inside coupon-specific code, not displayed/branched-on
 * across the admin, kitchen, and customer apps the way OrderStatus is.
 */
const couponTypeSchema = z.enum(["PERCENTAGE", "FIXED"]);

/** Coupon code — short uppercase identifier customers type in, e.g. "DIWALI10". */
export const couponCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{1,19}$/, "Coupon code must be 2-20 uppercase letters/digits/hyphens");

export const createCouponSchema = z
  .object({
    code: couponCodeSchema,
    type: couponTypeSchema,
    /** Percentage points (0-100) for PERCENTAGE, paise for FIXED — validated together with `type` below. */
    value: z.number().int().positive(),
    minOrderInPaise: z.number().int().nonnegative().optional(),
    maxDiscountInPaise: z.number().int().positive().optional(),
    usageLimit: z.number().int().positive().optional(),
    perCustomerLimit: z.number().int().positive().optional(),
    isFirstOrderOnly: z.boolean().default(false),
    branchId: uuidSchema.optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "PERCENTAGE" && data.value > 100) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "A percentage coupon's value can't exceed 100" });
    }
    if (data.endsAt.getTime() <= data.startsAt.getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "endsAt must be after startsAt" });
    }
  });
export type CreateCouponDto = z.infer<typeof createCouponSchema>;

export const updateCouponSchema = z.object({
  minOrderInPaise: z.number().int().nonnegative().nullable().optional(),
  maxDiscountInPaise: z.number().int().positive().nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  perCustomerLimit: z.number().int().positive().nullable().optional(),
  isFirstOrderOnly: z.boolean().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateCouponDto = z.infer<typeof updateCouponSchema>;

export const listCouponsQuerySchema = paginationQuerySchema.extend({
  isActive: z.coerce.boolean().optional(),
});
export type ListCouponsQueryDto = z.infer<typeof listCouponsQuerySchema>;

/** Customer-facing — applying/previewing a code against their own cart. */
export const applyCouponSchema = z.object({
  code: z.string().trim().min(1).max(20),
});
export type ApplyCouponDto = z.infer<typeof applyCouponSchema>;
