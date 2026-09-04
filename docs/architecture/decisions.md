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
