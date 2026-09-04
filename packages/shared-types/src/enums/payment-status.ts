/**
 * Payment status is tracked independently from OrderStatus (see
 * docs/architecture/payment-architecture.md). An order in
 * OUT_FOR_DELIVERY with paymentStatus PENDING and method COD is valid.
 *
 * Kept in sync manually with the `PaymentStatus` enum in
 * services/api/prisma/schema.prisma.
 */
export const PaymentStatus = {
  PENDING: "PENDING",
  AUTHORIZED: "AUTHORIZED",
  PAID: "PAID",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  REFUND_PENDING: "REFUND_PENDING",
  REFUNDED: "REFUNDED",
  PARTIALLY_REFUNDED: "PARTIALLY_REFUNDED",
} as const;

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PaymentMethod = {
  UPI: "UPI",
  CARD: "CARD",
  NET_BANKING: "NET_BANKING",
  COD: "COD",
  PAY_AT_STORE: "PAY_AT_STORE",
  DIRECT_UPI: "DIRECT_UPI",
} as const;

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod];

/** Methods collected offline by staff rather than through a payment gateway. */
export const OFFLINE_PAYMENT_METHODS: ReadonlySet<PaymentMethod> = new Set([
  PaymentMethod.COD,
  PaymentMethod.PAY_AT_STORE,
  PaymentMethod.DIRECT_UPI,
]);

export const RefundStatus = {
  PENDING: "PENDING",
  SUCCESS: "SUCCESS",
  FAILED: "FAILED",
} as const;

export type RefundStatus = (typeof RefundStatus)[keyof typeof RefundStatus];
