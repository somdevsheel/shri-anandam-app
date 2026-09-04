export const PAYMENT_PROVIDER = "PAYMENT_PROVIDER";

export interface ProviderOrderResult {
  providerOrderId: string;
  /** Raw provider response, stashed for troubleshooting — never returned to the client, never logged with secrets. */
  raw: unknown;
}

export interface ProviderRefundResult {
  providerRefundId: string;
  raw: unknown;
}

export type WebhookEventStatus = "captured" | "failed" | "refunded" | "unknown";

export interface ParsedWebhookEvent {
  /** Provider's own event id — the dedupe key alongside `provider` (section 13: idempotent processing). */
  eventId: string;
  type: string;
  status: WebhookEventStatus;
  providerOrderId?: string;
  providerPaymentId?: string;
  amountInPaise?: number;
}

/**
 * The one seam between order/payment domain code and a specific payment
 * gateway (section 12: "Do not tightly couple the order system to one
 * payment provider"). OrdersService and PaymentsService depend only on
 * this interface — swapping or adding a second gateway later is a new
 * class implementing it, not a change to either service.
 */
export interface PaymentProvider {
  /** Creates the gateway-side order/intent the client's checkout SDK opens against. */
  createProviderOrder(amountInPaise: number, receiptId: string): Promise<ProviderOrderResult>;

  /**
   * Verifies a webhook's signature against the RAW request body — must
   * run before `rawBody` is trusted for anything, including parsing.
   * Returns false (never throws) on a bad signature so the caller can
   * respond 401 uniformly.
   */
  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean;

  /** Only ever call after verifyWebhookSignature() has returned true for the same rawBody. */
  parseWebhookEvent(rawBody: Buffer): ParsedWebhookEvent;

  createRefund(providerPaymentId: string, amountInPaise: number): Promise<ProviderRefundResult>;
}
