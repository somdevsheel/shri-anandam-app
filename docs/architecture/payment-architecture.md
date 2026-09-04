# Payment Architecture

## Provider abstraction

```typescript
interface PaymentProvider {
  createOrder(amountInPaise: number, orderId: string): Promise<{ providerOrderId: string }>;
  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string): boolean;
  parseWebhookEvent(rawBody: Buffer): PaymentWebhookPayload;
  createRefund(providerPaymentId: string, amountInPaise: number): Promise<{ providerRefundId: string }>;
}
```

`RazorpayPaymentProvider` implements this for the online gateway;
`ManualPaymentProvider` implements the same interface trivially for
COD/Pay-at-Store/Direct-UPI (no external call — staff record the
collection directly). Order/payment domain code depends only on
`PaymentProvider`, never on Razorpay's SDK types — swapping or adding a
second gateway is a new adapter class, not a rewrite (implemented
alongside the Payments module in Phase 7).

## Flow (online payment)

```
Customer taps Pay
  → API creates Payment (status PENDING, provider RAZORPAY) + calls
    provider.createOrder()
  → Client opens Razorpay checkout with the returned providerOrderId
  → Customer completes payment on the gateway's UI
  → Gateway sends a webhook to the API — NOT a client callback
  → API verifies the webhook signature (HMAC, provider's documented
    method) before trusting anything in the payload
  → On verified success: Payment.status = PAID, Order.paymentStatus
    reflects it, OutboxEvent(PaymentSucceeded) is written in the same
    transaction
  → Only the OutboxEvent triggers the order-confirmed notification —
    the mobile app's own "payment succeeded" screen is UX only and is
    never what flips the order to confirmed server-side
```

**The mobile app's claim that payment succeeded is never trusted.** The
client-side checkout SDK callback only tells the UI which screen to show
next; the authoritative state change happens when the signed webhook is
verified.

## Payment status vs. order status (section 14)

Tracked independently — `Order.status` and `Order.paymentStatus` are
separate columns, not derived from one another. Valid combinations
include, e.g., `status = OUT_FOR_DELIVERY` with `paymentStatus = PENDING`
and `method = COD` — the kitchen/delivery flow proceeds without payment
having happened yet.

| PaymentStatus | Meaning |
|---|---|
| PENDING | Not yet collected/captured |
| AUTHORIZED | Gateway hold placed, not yet captured |
| PAID | Fully collected |
| FAILED | Gateway declined/errored |
| CANCELLED | Payment attempt abandoned |
| REFUND_PENDING | Refund initiated, not yet confirmed by gateway |
| REFUNDED | Fully refunded |
| PARTIALLY_REFUNDED | Some but not all of the amount refunded |

## Multiple transactions per order (section 16)

An `Order` has one or more `Payment` rows (one per method used — e.g. one
`Payment{method: UPI, amount: ₹500}` and one
`Payment{method: COD, amount: ₹1000}` for a split ₹1,500 order), and each
`Payment` can have multiple `PaymentTransaction` rows (authorization,
capture, and — for offline methods — the manual collection record: who
collected it, when, reference number, notes). The schema never assumes
"one order = one payment row."

## Offline payments (section 15)

COD and Pay-at-Store payments are created with `status = PENDING` at
order time. When staff physically collect the cash, a
`PAYMENT_COLLECT`-permissioned staff member marks it paid, which writes a
`PaymentTransaction{type: MANUAL_COLLECTION}` row with `collectedByStaffId`,
`referenceNumber` (for Direct UPI, the UTR), and `notes`. This is a
permissioned action (`payment.collect`), not something any staff role can
do, and it's audit-logged.

## Idempotent webhook processing (section 13)

`PaymentWebhookEvent` has a unique constraint on `(provider, eventId)`.
Processing a webhook is:

1. Verify signature. If invalid, log and reject (401) — do not process.
2. Insert `PaymentWebhookEvent` — if the unique constraint rejects the
   insert, this exact event was already processed; acknowledge 200 and
   stop (the gateway's retry succeeded at reaching us, we just don't
   redo the side effect).
3. Otherwise, apply the state change (Payment/Order update +
   OutboxEvent) inside the same transaction as marking the webhook row
   `processedAt`.

This makes redelivery (gateways retry webhooks aggressively) safe by
construction — a duplicate webhook cannot create a duplicate
`PaymentTransaction` or double-confirm an order.

## Refunds (section 17)

`Refund` rows reference their originating `Payment`, and record amount,
reason, `initiatedByStaffId`, provider reference, and status
(`PENDING` → `SUCCESS`/`FAILED`). Partial refunds are just a `Refund`
with `amountInPaise` less than the payment's total; multiple partial
refunds against one payment are allowed and their sum is validated
against the remaining refundable amount at creation time.

## Reconciliation (section 18)

The admin Payments/Reports screens (Phase 9) query across `Payment`,
`PaymentTransaction`, and `Refund` grouped by day and method to produce:
today's online collection, cash collection, store collection, direct
UPI, refunds, and net collection — a read-side report, not a separate
ledger table, since the transactional tables above already carry every
fact needed to compute it.

## What is never stored

No CVV, card PIN, or raw card number ever reaches this system — the
gateway's hosted checkout/tokenization handles card entry entirely on
its own infrastructure; the API only ever sees a `providerPaymentId`
token reference.
