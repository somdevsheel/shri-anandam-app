# Order Lifecycle

## State machine

```
PENDING → ACCEPTED → PREPARING → READY → OUT_FOR_DELIVERY → DELIVERED
   │          │           │         │
   └──────────┴───────────┴─────────┴──► CANCELLED
   └──► REJECTED (from PENDING only)
```

Canonical source: `packages/shared-types/src/enums/order-status.ts`
(`ORDER_STATUS_TRANSITIONS`, `isValidOrderStatusTransition`). The Prisma
`OrderStatus` enum in `services/api/prisma/schema.prisma` mirrors the same
values by hand (Prisma enums can't import TS) — keep both in sync when
this changes.

| From | Allowed to |
|---|---|
| PENDING | ACCEPTED, REJECTED, CANCELLED |
| ACCEPTED | PREPARING, CANCELLED |
| PREPARING | READY, CANCELLED |
| READY | OUT_FOR_DELIVERY, DELIVERED (pickup), CANCELLED |
| OUT_FOR_DELIVERY | DELIVERED, CANCELLED |
| DELIVERED | *(terminal)* |
| REJECTED | *(terminal)* |
| CANCELLED | *(terminal)* |

READY → DELIVERED is valid for pickup orders (`fulfillmentType =
PICKUP`), skipping OUT_FOR_DELIVERY, which only applies to home delivery.

Any transition not in this table — including the brief's explicit
counter-example, DELIVERED → PREPARING — is rejected by the order service
with `INVALID_STATE_TRANSITION` (409). A genuine correction to an
already-terminal order (e.g. staff mis-clicked Delivered) goes through an
explicit administrative correction action that writes an `OrderNote` +
`AuditLog` entry rather than mutating `status` directly, so the audit
trail always shows *why* history was overridden.

## Every transition is recorded

`order_status_history` gets one row per transition:

```
order_id | previous_status | new_status | actor_id | actor_type | reason | created_at
```

`actor_type` is `CUSTOMER` (cancels their own pending order),
`STAFF` (kitchen/admin action), or `SYSTEM` (e.g. auto-cancel on
reservation expiry). This table is the source of truth for the customer
tracking timeline (`OrderEvent` rows are the display-friendly projection
of the same facts) and for admin/kitchen "how long did this order sit in
PREPARING" reporting.

## Order number generation

Format: `SA-YYYYMMDD-NNNN`, e.g. `SA-20260904-1025`. Generated
server-side inside the same transaction that creates the order (a
per-day sequence, not a random/client-supplied value) — the client never
gets to choose or influence the order number.

## Order snapshot (section 10)

`OrderItem` stores `productNameSnapshot`, `variantNameSnapshot`,
`unitPriceInPaise`, `discountInPaise`, `taxInPaise`, and
`finalPriceInPaise` at the moment the order is placed.
`OrderAddressSnapshot` copies the delivery/pickup address at order time
into its own row rather than referencing `CustomerAddress` by foreign
key. Consequence: a later price change, product rename, or address edit
never alters what a historical order displays — order history is
genuinely immutable, not just "usually" immutable.

## Idempotent order creation (section 11)

The customer app sends an `Idempotency-Key` header (UUID generated once
per checkout attempt, reused across retries of the *same* attempt). The
order-creation endpoint:

1. Looks up `orders.idempotencyKey` (unique constraint) — if a row
   already exists for that key, returns the existing order instead of
   creating a second one.
2. If not found, creates the order, and the unique constraint itself is
   the concurrency guard: two simultaneous requests with the same key
   racing past step 1 will have exactly one `INSERT` succeed; the loser
   catches the unique-violation and re-reads the winner's row.

This means a customer double-tapping "Place Order" during a flaky network
window produces one order, not two, without needing a distributed lock.

## Transactional order creation (section 37)

Order creation is one Prisma transaction:

```
BEGIN
  validate cart server-side (price, availability, stock, coupon, zone)
  INSERT order + order_items (+ address snapshot)
  INSERT/UPDATE stock_reservations (hold inventory)
  INSERT payment (status PENDING, or PAID for already-verified methods)
  INSERT outbox_events (OrderCreated)
COMMIT
```

If any step fails, the whole transaction rolls back — no partial order,
no phantom stock reservation, no orphaned outbox event. The
`notification-worker` picks up the `OrderCreated` outbox row afterward
and pushes the owner's FCM notification; that delivery step is decoupled
from order creation succeeding, per `docs/architecture/notification-architecture.md`.
