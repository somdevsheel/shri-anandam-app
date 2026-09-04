# Architecture Decision Log

Short-form ADRs for the stack choices made while scaffolding the platform.
Update this file whenever a foundational decision is made or revisited.

## ADR-001: Monorepo tool — pnpm workspaces

**Decision:** pnpm workspaces (not Turborepo/Nx) for Phase 1.

**Why:** pnpm's content-addressed store and strict node_modules give fast,
disk-efficient installs and prevent phantom cross-package dependencies
(a common source of "works on my machine" bugs in monorepos). A single
`pnpm-workspace.yaml` covers `apps/*`, `services/*`, `packages/*`.

**Revisit when:** build times across the growing app/service count start
to hurt — at that point layer Turborepo (or Nx) on top for task caching
and affected-graph builds; both work natively on pnpm workspaces without
restructuring.

## ADR-002: Backend ORM — Prisma over TypeORM

**Decision:** Prisma as the database access layer for `services/api`.

**Why:** type-safe generated client (no `any` leaking from raw query
builders), first-class migration tooling (`prisma migrate`) with a
reviewable SQL diff per migration, and a single `schema.prisma` that acts
as living documentation of the whole data model (see
`services/api/prisma/schema.prisma`). TypeORM's Active Record/Data
Mapper patterns and decorator-heavy entities are more error-prone at this
schema's size (60+ tables).

**Trade-off accepted:** Prisma's relation-heavy nested `include` queries
compile to N+1-prone SQL if used carelessly — query complexity is a code
review concern, not a framework limitation.

## ADR-003: Password hashing — Argon2id over bcrypt

**Decision:** `argon2` (argon2id variant) for staff password hashing.

**Why:** OWASP's current recommended default; memory-hard by design,
which meaningfully raises the cost of GPU/ASIC-accelerated cracking
compared to bcrypt. Customer auth never uses a password at all (mobile
OTP only, per section 32 of the brief), so this only affects the much
smaller staff/admin surface.

## ADR-004: Validation — Zod over class-validator

**Decision:** Zod schemas in `packages/validation`, consumed by a shared
`ZodValidationPipe` in the API.

**Why:** the same schema object runs unmodified on the server (NestJS
pipe) and in React/React Native clients (form validation) — one
source of truth for validation rules instead of parallel
class-validator decorators server-side and a separate schema
client-side. Schemas are plain data, easy to unit test in isolation from
any framework.

## ADR-005: Money representation — integer paise, not floating point rupees

**Decision:** every monetary column/field is an integer count of paise
(`Int` in Prisma, `number` in TypeScript, always whole).

**Why:** floating-point rupees accumulate rounding error across
discounts, tax, and multi-item order totals — unacceptable for a system
handling real payments. `packages/shared-types/src/types/money.ts`
centralizes the paise↔rupee conversion and INR display formatting so
this rule can't be silently bypassed.

## ADR-006: Weight-based inventory — Decimal(12,3) grams, not floats

**Decision:** `stockQuantity` and all inventory deltas are
`Decimal(12,3)` stored in grams (or whole pieces for count-based items),
never IEEE-754 floats.

**Why:** repeated addition/subtraction of float grams (e.g. many 250g/
500g sales against a 17.5kg batch) drifts over time; `Decimal` avoids
that entirely and matches the kg-level precision described in section 30
of the brief while still supporting sub-gram accuracy if ever needed.

## ADR-007: RBAC — global Role/Permission tables, not per-branch roles (yet)

**Decision:** `Role` and `Permission` are organization-wide; a staff
member's permission set is the same at every branch they're assigned to
via `BranchStaff`.

**Why:** the brief's role list (OWNER, MANAGER, CASHIER, KITCHEN,
SUPPORT, ACCOUNTANT) and permission list (section 34) don't call for
per-branch permission overrides, and adding that axis now would be
speculative complexity (section 77: "do not overengineer without a
reason"). `BranchStaff` already scopes *which* branches a staff member
can act in; if a future requirement needs different permissions per
branch for the same person, it is a additive migration (a
`branchId` column on `StaffRole`), not a redesign.

## ADR-008: Queue — Redis Streams for Phase 1, RabbitMQ-compatible abstraction

**Decision:** `QUEUE_DRIVER=redis-streams` by default; the outbox
worker (Phase 8) is written against a small internal `QueuePublisher`
interface, not directly against `ioredis`.

**Why:** Redis is already a hard dependency for cache/OTP/rate-limiting,
so Redis Streams gives at-least-once delivery and consumer groups
without standing up a second piece of infrastructure for V1's order
volume. The publisher interface (not yet needed until Phase 8's
notification worker) is what section 38 calls for — swapping in RabbitMQ
or Kafka later is a new adapter, not a rewrite of domain code.

## ADR-009: Cross-package imports resolve through node_modules/dist, not tsconfig `paths`

**Decision:** `tsconfig.base.json` has no `paths` mapping to workspace
packages' `src/`. `@shri-anandam/shared-types` etc. resolve exactly the
way a published npm package would: through the pnpm-symlinked
`node_modules` entry, to whatever `package.json`'s `main`/`types` point
at (`dist/index.js`/`dist/index.d.ts`).

**Why:** Phase 1 had `paths` pointing at `src/` for editor convenience,
which worked while packages were leaves with no cross-imports among
themselves. Phase 2 introduced `packages/validation` importing
`@shri-anandam/shared-types` (for the `Role`/`Permission` enums in Zod
schemas), and `paths`-to-source made `tsc` pull `shared-types/src/*.ts`
into `validation`'s compilation — which `rootDir` then correctly rejected
(TS6059: those files aren't under `validation/src`). Resolving through
`node_modules`/`dist` instead sidesteps this entirely, since declaration
files from another package's `dist/` aren't subject to the importing
package's `rootDir`.

**Trade-off accepted:** a package must be rebuilt (`pnpm build`, or
build just that package) before a dependent package's typecheck/build/
dev picks up a source change — there is no live-source cross-package
resolution. Acceptable at this repo's size; revisit with TypeScript
project references (`composite`/`references`) if that friction starts
to hurt.

## ADR-010: Validation pipes are always parameter-scoped, never method-scoped

**Decision:** every `ZodValidationPipe` binding is `@Body(new ZodValidationPipe(schema))` / `@Query(...)` / `@Param(...)` on the specific parameter — never `@UsePipes(new ZodValidationPipe(schema))` at the method level.

**Why:** a method-level `@UsePipes()` runs that pipe against *every* resolved parameter, not just the one the schema is for. NestJS excludes the built-in `@Req()`/`@Res()`/`@Next()` decorators from this, but a custom parameter decorator (`@CurrentUser()`, used on nearly every staff-facing route to get the authenticated principal) is not excluded — it gets validated against the body/query schema too, and fails, because a `AuthenticatedStaff` object obviously doesn't match a `CreateBranchDto` shape. This was caught live (Phase 2 manual verification): `POST /branches` with a perfectly valid body returned `400 { name: Required, code: Required, address: Required }` — the error was actually coming from validating `request.user` against `createBranchSchema`, not from the body at all. Parameter-scoped pipes only ever see the one argument they're bound to, so this class of bug can't happen.

## ADR-011: Catalog admin permissions reuse product.* — no separate category/addon/variant permissions

**Decision:** `Category`, `ProductVariant`, `ProductImage`, `Addon`, and `BranchProduct` management all gate on `Permission.PRODUCT_READ/CREATE/UPDATE/DELETE` — there is no `category.manage`, `addon.manage`, etc.

**Why:** these entities only exist to describe or organize the catalog; the brief's own permission list (section 34) already treats "product" as the catalog's unit of access control, and staff.assign-style role design elsewhere in this codebase (ADR-007) is deliberately not fine-grained beyond what a real distinct admin workflow needs. A MANAGER who can create/edit products is expected to also manage the categories those products live in and the add-ons attached to them — splitting these into separate permissions would be permission sprawl with no real access-control benefit (section 77: don't overengineer without a reason). Branch/Organization got their own permissions in Phase 2 because those are genuinely distinct admin surfaces (see ADR for that phase's reasoning) — Category/Addon/Variant are not; they're catalog sub-resources.

## ADR-012: Public catalog price sort/filter deferred

**Decision:** `GET /catalog/products` supports pagination, search, category, tag, branch-availability, and featured filters, and sorts by name or newest — but not by price.

**Why:** a product's price is really a range across its variants (Kaju Katli 250g vs 2kg), so "sort products by price" requires either a denormalized `minPriceInPaise` column kept in sync on every variant write, or a proper search index. Section 51 already plans PostgreSQL search now with an abstraction that allows OpenSearch later — price sort/filter is a natural fit for that migration, not something to bolt onto a plain Prisma `orderBy` today. Revisit when Phase catalog-search work starts; until then this is a known, deliberate gap, not an oversight.

## ADR-013: Reservation-based inventory concurrency uses `SELECT ... FOR UPDATE`, not optimistic locking

**Decision:** `InventoryReservationService.reserve()` takes an explicit transaction handle and issues a raw `SELECT id, "stockQuantity" FROM inventory_items WHERE ... FOR UPDATE` before computing availability and inserting a `StockReservation` row — a real row-level lock, not a version-column compare-and-swap.

**Why:** section 31 requires that two simultaneous orders can never both reserve stock that doesn't exist. `FOR UPDATE` makes a second concurrent caller for the *same* inventory item block at the database until the first transaction commits or rolls back, so the availability check and the insert are atomic together — there's no window for a classic check-then-act race. This is proven, not just asserted: `inventory-reservation.service.integration.spec.ts` fires 20 genuinely concurrent `Promise.all` reservation attempts of 100g each against 1000g of stock and asserts exactly 10 succeed, 10 are rejected, and the sum of active reservations never exceeds committed stock.

**Pitfall hit while building this (worth flagging for the next raw SQL query against this schema):** every ID column here is Prisma's default `String @id @default(uuid())`, which maps to Postgres `text`, **not** the native `uuid` type. A `WHERE "branchId" = $1::uuid` cast on a raw query fails with `operator does not exist: text = uuid` — caught immediately by the integration test, not by inspection. Raw SQL against these tables should compare IDs as plain strings, no `::uuid` cast.

**`stockQuantity` mutations never need their own lock**, unlike `reserve()`: `consume()`, `restock()`, `adjust()`, and wastage all use Prisma's atomic `{ increment }`/`{ decrement }` — a single `UPDATE ... SET col = col ± $1` — which Postgres already serializes correctly at the row level without an application-level lock. The `FOR UPDATE` is specifically needed in `reserve()` because that operation reads a derived value (available = stock − active reservations) and makes a decision based on it before writing, the exact pattern optimistic/atomic updates can't protect on their own.

## ADR-014: React Native dependency versions come from `npx expo install`, never `npm view ... version`

**Decision:** every package in `apps/customer-mobile` (and any future Expo app) is version-pinned to whatever `npx expo install --check`/`--fix` recommends for the installed Expo SDK, not to npm's "latest" for that package.

**Why:** Expo SDK releases certify a specific matching set of `react`, `react-native`, and first-party module versions; the individual packages on npm keep releasing independently and their "latest" routinely runs ahead of what the current SDK actually supports. Building this app against `npm view <pkg> version` for each dependency (the obvious first approach) produced a real, reproducible failure: `react-native@0.87.1` (npm's latest at the time) is one minor ahead of what `expo@57.0.20` was built against (`0.86.3`), and `npx expo export --platform web` failed with `ERR_PACKAGE_PATH_NOT_EXPORTED` reaching into `react-native`'s `./rn-get-polyfills` subpath — a real bundler break, not a type error `tsc` would have caught. `npx expo install --fix` corrected six packages at once (react, react-dom, react-native, react-native-safe-area-context, react-native-screens, typescript) and the same export succeeded immediately after.

**Consequence:** after adding or upgrading any dependency in an Expo app, run `npx expo install --check` before trusting `tsc`/`eslint` alone — a version mismatch here is a bundler/runtime failure, not a type error, and won't show up any other way short of actually bundling (`npx expo export --platform web` is the fastest way to catch it without a device/simulator).

## ADR-015: Phase 6 checkout only accepts COD/Pay-at-Store; inventory reserve+consume happen together

**Decision:** `POST /orders` (checkout) restricts `paymentMethod` to `COD`/`PAY_AT_STORE` — UPI/CARD/NET_BANKING are rejected by the request schema itself, not just unimplemented. For every accepted line, `OrdersService.createOrder()` calls `InventoryReservationService.reserve()` immediately followed by `consume()` in the same transaction, rather than leaving the reservation `ACTIVE` pending a later confirmation step.

**Why:** the reservation engine (Phase 4, ADR-013) is deliberately built for a flow where something asynchronous — a payment gateway webhook — decides whether a hold becomes a real sale or gets released. That flow doesn't exist yet (Phase 7). For COD/Pay-at-Store, there is no async confirmation step at all: the order is confirmed the instant it's placed, so reserving stock and never consuming it (leaving it to expire) would be wrong — it would silently let the reservation TTL release inventory out from under a real, confirmed order. Reserve-then-consume-immediately is the correct behavior for exactly the payment methods available today.

**Consequence for Phase 7:** adding online payment doesn't change `reserve()`/`consume()` at all — it changes *when* `consume()` is called. The online-payment order-creation path reserves stock (same as today) but stops short of calling `consume()`; the webhook handler calls it once the gateway confirms payment, using the same reservation id. This is additive, not a rewrite, which is exactly what ADR-013 set out to make possible.

## ADR-016: Tax, coupons, and tiered delivery charges are explicit Phase 6 gaps, not oversights

**Decision:** `Order.taxInPaise` and `Order.discountInPaise` are always `0` in the current checkout flow. Delivery fee resolution (`DeliveryFeeService`) applies only a `DeliveryZone`'s flat `deliveryFeeInPaise`/`freeDeliveryThresholdInPaise` — the tiered `DeliveryChargeRule` surcharges the schema already supports are not evaluated.

**Why:** section 76's Phase 6 scope is explicitly "Checkout, Order creation, Order state machine, Order history, Reorder" — coupons are Marketing (their own schema section, no dedicated phase yet) and tax computation isn't called out as Phase 6 scope at all. Both fields already exist on `Order`/`OrderItem` precisely so wiring them in later is a matter of computing a non-zero value at the right point in `createOrder()`, not a schema change. Shipping checkout without them, honestly labeled, is more useful than blocking Phase 6 on features with their own dedicated future phase — a real order can be placed and fulfilled today; discount/tax lines will show correctly (as zero) until those phases land.

## ADR-017: Online payment — provider calls outside the DB transaction; webhook dedup key derived, not trusted from a single field

**Decision:** `OrdersService.createOrder()` commits the order/payment/reservation transaction first, then calls `PaymentsService.initiatePayment()` (which hits Razorpay's API) *after* that commit — never inside it. If the gateway call fails, the order still exists with a `PENDING` payment lacking a `providerOrderId`; the customer (or the client automatically) retries via `POST /payments/:id/initiate` rather than the whole checkout failing. Separately, `RazorpayPaymentProvider.parseWebhookEvent()` derives its dedupe key as `` `${eventType}:${entity.id}` `` rather than trusting a single top-level "event id" field.

**Why (transaction boundary):** an external HTTP call has unbounded, unpredictable latency; holding a Postgres transaction open for it would hold row locks (including the `InventoryItem` `FOR UPDATE` lock from `reserve()`) for however long Razorpay takes to respond, serializing unrelated checkouts against the same product behind a slow network call. Section 66's statelessness goal and section 47's failure-handling requirements both point the same direction: the DB write must be able to commit and be durable independent of whether the gateway call that logically follows it succeeds.

**Why (webhook dedup key):** Razorpay's webhook payload shape isn't uniformly documented to carry one single reliable top-level event id across every event type and API version, and this repo has no live Razorpay account to verify the current exact schema against (see the provider's own file comment). The composite of `(event type, payment/refund entity id)` is what's actually guaranteed stable and re-delivered byte-for-byte identical on a retry — which is what section 13's "idempotent, retry-safe" requirement actually needs, regardless of whether a more specific field also exists. This is a deliberately conservative, defensible choice given the uncertainty, not an assumption of certainty about a schema this repo can't check.

**Confirms ADR-015's prediction:** adding online payment did not touch `InventoryReservationService.reserve()`/`consume()`/`release()` at all — `OrdersService` now conditionally skips the `consume()` call for online methods, and `PaymentsService.handleWebhook()` calls `consume()` (on success) or `release()` (on failure) using the same reservation rows `reserve()` already created at checkout. Exactly the additive extension ADR-015 predicted, not a rewrite.

**Verified without real Razorpay credentials:** signature verification and webhook parsing are pure functions this repo can test completely on its own (self-signed payloads with a known test secret — see `razorpay-payment.provider.spec.ts`). What genuinely cannot be verified here is a live call to Razorpay's Orders/Refunds API (no sandbox account provisioned) — `createProviderOrder()`/`createRefund()` fail closed with a clear `SERVICE_UNAVAILABLE`/`BAD_GATEWAY` error when credentials are absent or the call fails, verified live: a full checkout with an online method still succeeds end-to-end (order created, stock correctly reserved-not-consumed) even though the Razorpay call inside it fails for lack of credentials.

## ADR-018: `notification-worker` talks to Postgres via raw `pg`, not a shared generated Prisma client

**Decision:** `services/notification-worker` is a separate deployable from `services/api` (section 21's outbox consumer). It reads/writes the same Postgres database, but through hand-written parameterized queries in `services/notification-worker/src/db.ts` (node-postgres `Pool`), not by importing `services/api`'s generated `@prisma/client`.

**Why:** Prisma's client generation output resolution is ambiguous across a pnpm workspace when `prisma generate --schema=<cross-package path>` is invoked from a different package's directory — it can resolve relative to the schema file's own `node_modules` rather than the invoking package's, and this repo has no clean precedent elsewhere for two independently-buildable/deployable services sharing one generated client. Rather than empirically chase that fragility, the worker's actual data-access surface is small (~10 simple queries: claim outbox events, look up an order/product/device rows, write a Notification, deactivate a dead token) — nothing that needs an ORM's relation-loading. Raw `pg` decouples the worker's build/deploy cycle from `services/api`'s Prisma generation step entirely, at the cost of hand-maintaining SQL that must be kept in sync with schema changes made in `services/api/prisma/schema.prisma` (mitigated by the fact both live in the same repo/PR, and by `getProductNameByVariantId`-style bugs — see below — being exactly the kind of thing integration testing against a real Postgres catches).

**Consequence surfaced by testing:** because the worker's queries are hand-written, they're checked by nothing but tests and live testing — no Prisma-level type safety against schema drift. Caught live during Phase 8 verification: `getProductName` had queried `products` with a value that is actually a `product_variants.id` (the `InventoryLow` outbox payload carries `productVariantId`, confirmed against `InventoryReservationService.maybeFlagLowStock`); fixed by renaming to `getProductNameByVariantId` and properly joining `product_variants` → `products`. This is the argument for keeping the worker's query surface deliberately small, not a reason to prefer this approach without reservation.

## ADR-019: Notification writes are upserted on `(outboxEventId, deviceId)`, not inserted fresh per attempt

**Decision:** `Notification` gained an `outboxEventId` column (nullable FK to `OutboxEvent`, migration `notification_outbox_event_idempotency`) with `@@unique([outboxEventId, deviceId])`. `NotificationDb.insertNotification()` in the worker is an `INSERT ... ON CONFLICT (outboxEventId, deviceId) DO UPDATE` rather than a plain `INSERT`.

**Why:** `OutboxProcessor.processOne()` re-runs its entire target-resolution + notify loop on every retry of a `PENDING` outbox event (FCM failing closed without real credentials, per ADR-018's sibling context, means every event in this repo's dev environment currently retries `MAX_RETRIES` times before landing `FAILED`). The original plain-`INSERT` version wrote a brand-new `Notification` row on every retry attempt for the same device — verified live: a single test order produced 5 duplicate "NEW ORDER" rows for a single owner device after 5 failed-closed retries, which would both pollute `GET /notifications` history and, once real FCM credentials exist, risk sending the same push multiple times to the same device for one logical event. The upsert makes a (event, device) pair's notification exactly one row regardless of retry count, with each retry correctly refreshing its `status` back to `PENDING` and clearing `sentAt` rather than leaving a stale `SENT`/`FAILED` from an earlier attempt.

**Also caught in the same pass:** `getOwnerDeviceTokens()` (used for `OrderCreated`/`InventoryLow` targeting) returned `{id, fcmToken, platform}` with no `staffId`, so `resolveNewOrderTargets`/`resolveLowStockTargets` never passed a `staffId` into `insertNotification` — every owner-targeted `Notification` row was written with `staffId = NULL`. Since `NotificationsService.listMine()` filters staff by `staffId: actor.id`, this meant `GET /notifications` would return an empty list for every staff member, permanently — the owner app's "notification history" screen (section 19) would have looked broken with no server-side error to explain why. Fixed by selecting `dt."staffId"` in the query and threading it through both resolver methods; verified live (`GET /notifications` as the owner now returns their own rows; as the customer, only theirs).
