import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { ParsedWebhookEvent, PaymentProvider, ProviderOrderResult, ProviderRefundResult } from "./payment-provider.interface";

/**
 * COD / Pay-at-Store / Direct-UPI never talk to an external gateway —
 * staff record collection/refund directly (PaymentsService.collect()/
 * PaymentsService.recordManualRefund()), so this provider exists only to
 * satisfy the PaymentProvider interface where generic code expects one.
 * OrdersService's offline checkout path doesn't call any of these
 * methods at all (see ADR-015/017) — this is a documented no-op, not a
 * partially-working gateway.
 */
@Injectable()
export class ManualPaymentProvider implements PaymentProvider {
  async createProviderOrder(): Promise<ProviderOrderResult> {
    return { providerOrderId: `manual_${randomUUID()}`, raw: null };
  }

  verifyWebhookSignature(): boolean {
    return false; // manual payments never receive gateway webhooks
  }

  parseWebhookEvent(): ParsedWebhookEvent {
    throw new Error("ManualPaymentProvider never receives webhooks");
  }

  async createRefund(): Promise<ProviderRefundResult> {
    return { providerRefundId: `manual_refund_${randomUUID()}`, raw: null };
  }
}
