# Database Architecture

Full schema: `services/api/prisma/schema.prisma`. This document explains
the conventions and the reasoning behind the less obvious modeling
choices — read it alongside the schema, not instead of it.

## Conventions

- **UUID primary keys** everywhere (`@default(uuid())`), generated
  application/DB-side — never auto-increment integers, so IDs are safe to
  expose in URLs and never leak order/customer volume.
- **`createdAt`/`updatedAt`** on every mutable table.
- **Money as integer paise** (`Int`), never `Float`/`Decimal` rupees —
  see ADR-005.
- **Weight as `Decimal(12,3)` grams**, never `Float` — see ADR-006.
- **Foreign keys** for every relationship; **unique constraints** where
  the business rule demands it (`Order.orderNumber`,
  `Order.idempotencyKey`, `Product.slug`, `Coupon.code`,
  `PaymentWebhookEvent.(provider, eventId)`, `InventoryItem.(branchId,
  productVariantId)`, etc.) — the database enforces these invariants,
  the application does not merely hope to.
- **JSON only for provider/audit metadata** (`PaymentWebhookEvent.rawPayload`,
  `AuditLog.oldValue`/`newValue`, `OrderEvent.payload`,
  `SecurityEvent.metadata`) — every field that needs to be queried,
  joined, filtered, or constrained is a real column, per section 36.

## Simplification vs. the brief's table list

Section 35 lists `users` as a table separate from `customers`/`staff`.
This schema instead has `Customer` and `Staff` as the two concrete
identity tables directly (no generic polymorphic `User` row underneath
them) — Nest's auth layer distinguishes them by `subjectType` in the JWT
rather than by a shared table. Correspondingly, `roles`/`user_roles`
became `Role`/`StaffRole` (only staff carry RBAC roles; customers never
need one). This is a deliberate simplification (ADR-007) that keeps the
common case — "is this a customer or a staff member" — a type-level
distinction instead of a runtime `discriminator` column, while still
covering every entity the brief's list names. Revisit if a future
requirement needs a genuinely shared identity (e.g. a staff member who is
also a customer using one login).

## Inventory is tracked per variant/SKU, not as a shared bulk pool

`InventoryItem` is unique per `(branchId, productVariantId)` — each
packaged size (Kaju Katli 250g, 500g, 1kg, 2kg) has its **own** stock
figure, produced and restocked independently (`ProductionBatch` records
a batch of one specific variant). This is deliberately different from
section 30's illustrative example ("Available stock = 17.5 kg... orders
500g... system reserves 0.5 kg"), which describes a single bulk pool
divided across variants by weight.

Both are legitimate models; this schema chose per-variant tracking
because it matches how a sweets shop that pre-packages fixed-weight
boxes actually operates (each box size is produced, boxed, and shelved
as its own finished good) and keeps a cart/order's `quantity` field a
plain count with no unit-conversion math anywhere in the order path.

**Consequence for `InventoryItem.unit`:** for a fixed-weight packaged
variant, `unit` should be `PIECE` and `stockQuantity` is a count of
boxes (e.g. `4` means four 500g boxes on the shelf) — a cart/order
quantity of `2` consumes exactly `2` from that count. `unit: GRAM` is
reserved for a genuinely bulk/loose-sold variant (a single "Kaju Katli —
sold by weight" SKU where the customer specifies an exact gram amount at
add-to-cart time) — that flow doesn't exist yet; building it would mean
extending `CartItem`/`OrderItem` with a customer-entered weight rather
than a plain integer quantity, which is a real but separate feature, not
something to bolt onto the current fixed-package flow.

## Reservation-based inventory (section 31)

`StockReservation` rows hold stock during checkout without decrementing
`InventoryItem.stockQuantity` directly:

1. Checkout starts → `StockReservation{status: ACTIVE, expiresAt: now + N minutes}`
   created inside the order-creation transaction, and the *available*
   quantity a subsequent request sees is
   `stockQuantity - SUM(active reservations)`, computed at read time
   (not stored) so concurrent reservations can't both succeed against
   stock that only exists once.
2. Order confirmed (payment settles / COD accepted) →
   `StockReservation.status = CONSUMED`, and an `InventoryTransaction{type:
   SALE}` row actually decrements `stockQuantity`.
3. Order abandoned/cancelled before confirmation → `RELEASED`.
4. Reservation TTL elapses with no order confirmation → a scheduled job
   (Phase 4) marks it `EXPIRED` and the held quantity becomes available
   again.

Every stock read that matters for a purchase decision runs inside a
transaction using `SELECT ... FOR UPDATE` (row-level lock on the
`InventoryItem` row) around the reservation check-and-insert, so two
simultaneous orders for the last 500g of Kaju Katli cannot both succeed
— the second one's lock wait resolves after the first commits, and it
then correctly sees insufficient stock.

## Indexing (section 50)

Indexes are added for the query patterns the brief specifically calls
out, not preemptively on every column:

- `orders`: `customerId`, `branchId`, `status`, `paymentStatus`,
  `createdAt` (plus the unique indexes on `orderNumber`/`idempotencyKey`)
- `products`/`branch_products`: `categoryId`+`isActive`,
  `branchId`+`isActive`
- `inventory_items`: `branchId` (plus the unique
  `(branchId, productVariantId)`)
- `notifications`: `(customerId, status)`, `(staffId, status)`, `createdAt`
- `payments`: `orderId`, `status`, `providerPaymentId`

Additional indexes get added when a real query plan (`EXPLAIN ANALYZE`)
shows a sequential scan on a table large enough to matter — not
speculatively.

## Migrations

Prisma Migrate (`pnpm prisma:migrate` locally, `prisma migrate deploy` in
CI/production — see `.github/workflows/ci.yml`). Every schema change is
a reviewed, versioned SQL file under `services/api/prisma/migrations/`,
never a manual `db push` against a shared environment.
