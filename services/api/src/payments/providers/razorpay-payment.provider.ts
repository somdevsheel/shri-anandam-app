import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "../../common/errors/app.error";
import { ErrorCode } from "@shri-anandam/shared-types";
import { HttpStatus } from "@nestjs/common";
import type { ParsedWebhookEvent, PaymentProvider, ProviderOrderResult, ProviderRefundResult } from "./payment-provider.interface";

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";

interface RazorpayOrderResponse {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

interface RazorpayRefundResponse {
  id: string;
  amount: number;
  status: string;
}

/**
 * Real Razorpay Orders/Refunds API integration + webhook signature
 * verification. Requires RAZORPAY_KEY_ID/RAZORPAY_KEY_SECRET (order/
 * refund creation) and RAZORPAY_WEBHOOK_SECRET (signature verification)
 * — see .env.example. Without real Razorpay sandbox credentials this
 * class cannot be exercised end-to-end in this repo's automated tests;
 * what IS tested is everything that doesn't require reaching Razorpay's
 * servers: signature verification and webhook parsing, both pure
 * functions over a payload this service can construct and sign itself
 * with a known test secret (see razorpay-payment.provider.spec.ts).
 */
@Injectable()
export class RazorpayPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(RazorpayPaymentProvider.name);

  constructor(private readonly config: ConfigService) {}

  async createProviderOrder(amountInPaise: number, receiptId: string): Promise<ProviderOrderResult> {
    const keyId = this.config.get<string>("RAZORPAY_KEY_ID");
    const keySecret = this.config.get<string>("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) {
      throw new AppError(
        ErrorCode.INTERNAL_ERROR,
        "Online payment is not configured on this server yet",
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const response = await fetch(`${RAZORPAY_API_BASE}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      },
      body: JSON.stringify({ amount: amountInPaise, currency: "INR", receipt: receiptId, payment_capture: 1 }),
    });

    const body = (await response.json().catch(() => null)) as RazorpayOrderResponse | { error?: { description?: string } } | null;
    if (!response.ok || !body || !("id" in body)) {
      const message = body && "error" in body ? body.error?.description : undefined;
      this.logger.error(`Razorpay order creation failed (${response.status}): ${message ?? "unknown error"}`);
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Could not start the payment — please try again", HttpStatus.BAD_GATEWAY);
    }

    return { providerOrderId: body.id, raw: body };
  }

  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined): boolean {
    const secret = this.config.get<string>("RAZORPAY_WEBHOOK_SECRET");
    if (!secret || !signatureHeader) return false;

    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const expectedBuf = Buffer.from(expected, "utf8");
    const actualBuf = Buffer.from(signatureHeader, "utf8");

    // timingSafeEqual throws on length mismatch rather than returning
    // false — an attacker-controlled header must never crash the
    // handler, so the length check happens first.
    if (expectedBuf.length !== actualBuf.length) return false;
    return timingSafeEqual(expectedBuf, actualBuf);
  }

  parseWebhookEvent(rawBody: Buffer): ParsedWebhookEvent {
    const payload = JSON.parse(rawBody.toString("utf8"));
    const eventType: string = payload.event;
    const entity = payload.payload?.payment?.entity ?? payload.payload?.refund?.entity;

    // Razorpay's webhook body doesn't reliably carry a single top-level
    // event id across all event types/API versions in the way e.g.
    // Stripe's `id` does — the composite of (event type, payment/refund
    // entity id) is what's actually stable and re-delivered identically
    // on a retry, so that's the dedupe key stored in
    // PaymentWebhookEvent's unique (provider, eventId) constraint.
    const eventId = `${eventType}:${entity?.id ?? "unknown"}`;

    const status: ParsedWebhookEvent["status"] =
      eventType === "payment.captured"
        ? "captured"
        : eventType === "payment.failed"
          ? "failed"
          : eventType === "refund.processed"
            ? "refunded"
            : "unknown";

    return {
      eventId,
      type: eventType,
      status,
      providerOrderId: entity?.order_id,
      providerPaymentId: payload.payload?.payment?.entity?.id,
      amountInPaise: entity?.amount,
    };
  }

  async createRefund(providerPaymentId: string, amountInPaise: number): Promise<ProviderRefundResult> {
    const keyId = this.config.get<string>("RAZORPAY_KEY_ID");
    const keySecret = this.config.get<string>("RAZORPAY_KEY_SECRET");
    if (!keyId || !keySecret) {
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Online refunds are not configured on this server yet", HttpStatus.SERVICE_UNAVAILABLE);
    }

    const response = await fetch(`${RAZORPAY_API_BASE}/payments/${providerPaymentId}/refund`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      },
      body: JSON.stringify({ amount: amountInPaise }),
    });

    const body = (await response.json().catch(() => null)) as RazorpayRefundResponse | { error?: { description?: string } } | null;
    if (!response.ok || !body || !("id" in body)) {
      const message = body && "error" in body ? body.error?.description : undefined;
      this.logger.error(`Razorpay refund failed (${response.status}): ${message ?? "unknown error"}`);
      throw new AppError(ErrorCode.INTERNAL_ERROR, "Refund could not be processed with the payment provider", HttpStatus.BAD_GATEWAY);
    }

    return { providerRefundId: body.id, raw: body };
  }
}
