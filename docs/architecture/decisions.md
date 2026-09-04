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
