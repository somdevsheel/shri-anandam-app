import { createHmac } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { RazorpayPaymentProvider } from "./razorpay-payment.provider";

const WEBHOOK_SECRET = "test_webhook_secret_do_not_use_in_prod";

function makeProvider(env: Record<string, string> = {}): RazorpayPaymentProvider {
  const config = { get: (key: string) => env[key] } as unknown as ConfigService;
  return new RazorpayPaymentProvider(config);
}

function sign(body: string): string {
  return createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
}

describe("RazorpayPaymentProvider (unit — no network required)", () => {
  describe("verifyWebhookSignature", () => {
    it("accepts a correctly-signed payload", () => {
      const provider = makeProvider({ RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET });
      const body = Buffer.from(JSON.stringify({ event: "payment.captured" }));
      expect(provider.verifyWebhookSignature(body, sign(body.toString()))).toBe(true);
    });

    it("rejects a tampered payload signed for different content", () => {
      const provider = makeProvider({ RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET });
      const original = Buffer.from(JSON.stringify({ event: "payment.captured", amount: 10000 }));
      const signatureForOriginal = sign(original.toString());
      const tampered = Buffer.from(JSON.stringify({ event: "payment.captured", amount: 999999 }));

      expect(provider.verifyWebhookSignature(tampered, signatureForOriginal)).toBe(false);
    });

    it("rejects when the secret is not configured (fails closed, not open)", () => {
      const provider = makeProvider({}); // no RAZORPAY_WEBHOOK_SECRET
      const body = Buffer.from(JSON.stringify({ event: "payment.captured" }));
      expect(provider.verifyWebhookSignature(body, sign(body.toString()))).toBe(false);
    });

    it("rejects a missing signature header", () => {
      const provider = makeProvider({ RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET });
      const body = Buffer.from(JSON.stringify({ event: "payment.captured" }));
      expect(provider.verifyWebhookSignature(body, undefined)).toBe(false);
    });

    it("does not throw on a signature of a different length than expected (timingSafeEqual guard)", () => {
      const provider = makeProvider({ RAZORPAY_WEBHOOK_SECRET: WEBHOOK_SECRET });
      const body = Buffer.from(JSON.stringify({ event: "payment.captured" }));
      expect(() => provider.verifyWebhookSignature(body, "short")).not.toThrow();
      expect(provider.verifyWebhookSignature(body, "short")).toBe(false);
    });
  });

  describe("parseWebhookEvent", () => {
    it("parses a payment.captured event", () => {
      const provider = makeProvider();
      const payload = {
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_abc123", order_id: "order_xyz789", amount: 62000, status: "captured" } } },
      };
      const parsed = provider.parseWebhookEvent(Buffer.from(JSON.stringify(payload)));

      expect(parsed.status).toBe("captured");
      expect(parsed.providerPaymentId).toBe("pay_abc123");
      expect(parsed.providerOrderId).toBe("order_xyz789");
      expect(parsed.amountInPaise).toBe(62000);
      expect(parsed.eventId).toBe("payment.captured:pay_abc123");
    });

    it("parses a payment.failed event", () => {
      const provider = makeProvider();
      const payload = {
        event: "payment.failed",
        payload: { payment: { entity: { id: "pay_failed1", order_id: "order_xyz789", amount: 62000, status: "failed" } } },
      };
      const parsed = provider.parseWebhookEvent(Buffer.from(JSON.stringify(payload)));

      expect(parsed.status).toBe("failed");
      expect(parsed.providerPaymentId).toBe("pay_failed1");
    });

    it("produces the SAME eventId for a redelivered (retried) webhook — the dedupe key must be stable", () => {
      const provider = makeProvider();
      const payload = {
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_retry1", order_id: "order_xyz789", amount: 1000, status: "captured" } } },
      };
      const first = provider.parseWebhookEvent(Buffer.from(JSON.stringify(payload)));
      const redelivered = provider.parseWebhookEvent(Buffer.from(JSON.stringify(payload))); // Razorpay resends the identical body on retry

      expect(first.eventId).toBe(redelivered.eventId);
    });
  });
});
