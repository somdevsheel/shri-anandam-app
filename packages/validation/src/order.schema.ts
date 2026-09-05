import { z } from "zod";
import { OrderStatus, PaymentMethod } from "@shri-anandam/shared-types";
import { paginationQuerySchema, uuidSchema } from "./common.schema";

const fulfillmentTypeSchema = z.enum(["DELIVERY", "PICKUP"]);

/**
 * Phase 7 adds the Razorpay-backed online methods alongside the offline
 * ones Phase 6 shipped with — see docs/architecture/payment-architecture.md
 * and ADR-015/ADR-017 in decisions.md for how OrdersService branches on
 * this (reserve+consume immediately for offline, reserve-only pending a
 * webhook for online).
 */
const checkoutPaymentMethodSchema = z.enum([
  PaymentMethod.COD,
  PaymentMethod.PAY_AT_STORE,
  PaymentMethod.UPI,
  PaymentMethod.CARD,
  PaymentMethod.NET_BANKING,
]);

export const createOrderSchema = z
  .object({
    fulfillmentType: fulfillmentTypeSchema,
    addressId: uuidSchema.optional(),
    scheduledFor: z.coerce.date().optional(),
    paymentMethod: checkoutPaymentMethodSchema,
    /** Validated against the cart server-side by CouponsService.resolveForCart — never trusted as a pre-computed discount. */
    couponCode: z.string().trim().min(1).max(20).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.fulfillmentType === "DELIVERY" && !data.addressId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["addressId"], message: "addressId is required for delivery orders" });
    }
    if (data.scheduledFor && data.scheduledFor.getTime() < Date.now() - 60_000) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["scheduledFor"], message: "scheduledFor must be in the future" });
    }
  });
export type CreateOrderDto = z.infer<typeof createOrderSchema>;

const orderStatusSchema = z.enum([
  OrderStatus.PENDING,
  OrderStatus.ACCEPTED,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.REJECTED,
  OrderStatus.CANCELLED,
]);

export const updateOrderStatusSchema = z.object({
  status: orderStatusSchema,
  reason: z.string().trim().max(300).optional(),
});
export type UpdateOrderStatusDto = z.infer<typeof updateOrderStatusSchema>;

export const cancelOrderSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});
export type CancelOrderDto = z.infer<typeof cancelOrderSchema>;

export const addOrderNoteSchema = z.object({
  note: z.string().trim().min(1).max(1000),
});
export type AddOrderNoteDto = z.infer<typeof addOrderNoteSchema>;

/** Customer's own order history — no cross-customer filters, scope is always "my orders." */
export const listMyOrdersQuerySchema = paginationQuerySchema.extend({
  status: orderStatusSchema.optional(),
});
export type ListMyOrdersQueryDto = z.infer<typeof listMyOrdersQuerySchema>;

/** Staff/admin order list — branch and date-range scoped. */
export const listOrdersAdminQuerySchema = paginationQuerySchema.extend({
  branchId: uuidSchema.optional(),
  status: orderStatusSchema.optional(),
  customerId: uuidSchema.optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});
export type ListOrdersAdminQueryDto = z.infer<typeof listOrdersAdminQuerySchema>;
