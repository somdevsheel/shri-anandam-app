# Shri Anandam Sweets & Restaurant — Production Platform

A production-grade food ordering and restaurant commerce platform:
customer ordering app, owner order-notification app, admin web panel,
and a kitchen/counter PWA, sharing one NestJS + PostgreSQL backend.

See `docs/architecture/` for the full design (production architecture,
order lifecycle, payment architecture, database schema, security, React
Native decisions, notifications, deployment) and `docs/architecture/decisions.md`
for the reasoning behind each stack choice.

## Repository layout

```
apps/
  customer-mobile/   React Native (Expo) — customers
  owner-mobile/       React Native (Expo) — restaurant owner, new-order push
  admin-web/          Next.js — full business management
  kitchen-web/        Next.js PWA — kitchen/counter order queue

services/
  api/                 NestJS — the backend
  worker/              Background jobs (stock reservation expiry, reports, ...)
  notification-worker/ Outbox consumer → FCM/SMS/Email delivery

packages/
  shared-types/  Order/payment status enums, RBAC roles & permissions, API envelope types
  validation/    Zod schemas shared by the API and every client
  config/        Environment schema (fail-fast startup validation)
  api-client/    Typed API client shared across the four frontends (Phase 5+)
  ui/            Shared design-system components for the web apps (Phase 9+)
  utilities/     Small framework-agnostic helpers

infrastructure/  Dockerfiles, Nginx, monitoring config, scripts
docs/            Architecture, API, database, deployment, security docs
```

## Prerequisites

- Node.js ≥ 20, pnpm ≥ 9 (`corepack enable` will install the pinned version)
- Docker (for local Postgres/Redis/MinIO)

## Getting started

```bash
cp .env.example .env
pnpm install
pnpm docker:up                                    # Postgres, Redis, MinIO
pnpm --filter @shri-anandam/api prisma:generate
pnpm --filter @shri-anandam/api prisma:migrate     # creates the first migration on a fresh DB
pnpm --filter @shri-anandam/api prisma:seed        # RBAC roles/permissions + a bootstrap OWNER login
pnpm dev:api
```

API now running at `http://localhost:4000/api/v1`, health check at
`http://localhost:4000/health`. The seed script prints a bootstrap OWNER
email/password for local login — **never used in production** (the seed
skips creating it when `NODE_ENV=production`).

## Running the customer mobile app

With the API running (above):

```bash
cd apps/customer-mobile
cp .env.example .env          # EXPO_PUBLIC_API_URL — defaults to http://localhost:4000/api/v1
npx expo start                # scan the QR code with Expo Go, or press `a`/`i` for a simulator
```

`npx expo start --web` also works for a quick check without a device/
simulator — the app renders the same React Native code via
react-native-web. See `docs/architecture/react-native-architecture.md`
for why this is Expo (dev client + EAS) rather than bare RN CLI, and
`apps/customer-mobile/assets/README.md` — the icon/splash images
currently checked in are placeholders, not brand assets.

## Running the owner mobile app

Same idea as the customer app, pointed at the staff-only login/order-
management screens instead of OTP/browsing:

```bash
cd apps/owner-mobile
cp .env.example .env
npx expo start
```

Staff sign in with email/password (seeded bootstrap OWNER credentials —
see above), not OTP. Push notifications need a real Firebase project
(`google-services.json`) this repo doesn't ship with — see
`docs/architecture/decisions.md` ADR-018/019 for how that's handled
without one.

## Running the admin web app

```bash
cd apps/admin-web
cp .env.example .env.local     # Next.js convention — .env.local, not .env
pnpm dev
```

Open `http://localhost:3000/login` and sign in with the same staff
credentials as the owner app. See ADR-020 in `docs/architecture/decisions.md`
for why auth here is an in-memory access token plus an `httpOnly`
refresh cookie set by `app/api/auth/*` Route Handlers, rather than the
mobile apps' `expo-secure-store` approach — a browser has no equivalent
of an OS keychain to hold a long-lived token in.

## Common commands

```bash
pnpm lint            # eslint across every package
pnpm typecheck        # tsc --noEmit across every package
pnpm test             # jest across every package
pnpm build            # build every package/service
pnpm prisma:studio    # browse the local database
```

## Status

Phases 1–5 of the build are in place (see section 76 of the project
brief for the full phase list):

- **Phase 1 — Foundation**: monorepo, NestJS API, PostgreSQL schema,
  Redis, JWT auth (customer OTP + staff password) with rotating refresh
  tokens, RBAC via a global permissions guard, structured logging,
  global error handling, health checks, Docker, CI.
- **Phase 2 — Organization**: branches, staff, roles & permissions,
  audit logging, with safety guards (can't deactivate your own account,
  can't leave the org with zero active OWNERs).
- **Phase 3 — Catalog**: categories, products, weight-based variants,
  images, add-ons, price history, and the public browsing API.
- **Phase 4 — Inventory**: stock, a transaction-safe reservation engine
  (`SELECT ... FOR UPDATE`, proven under real concurrent load — see
  `services/api/src/inventory/inventory-reservation.service.integration.spec.ts`),
  adjustments, wastage, production batches.
- **Phase 5 — Customer app**: `apps/customer-mobile` (Expo/React
  Native) — onboarding, mobile OTP auth, home/category/search browsing,
  product detail, a server-aware cart (`services/api/src/cart`) that
  never trusts a cached price, and saved addresses.
- **Phase 6 — Orders**: checkout (COD/pay-at-store), the order status
  state machine (`packages/shared-types`' `isValidOrderStatusTransition`),
  order history, reorder.
- **Phase 7 — Payments**: a `PaymentProvider` abstraction with a real
  Razorpay implementation (HMAC-verified webhooks, refunds) and an
  offline `ManualPaymentProvider`; payment reconciliation reporting.
- **Phase 8 — Owner app & notifications**: `services/notification-worker`
  (the outbox → FCM delivery pipeline), device registration, and
  `apps/owner-mobile` (Expo/React Native) — order queue, order detail
  with status-transition actions gated by the signed-in staff member's
  real permissions, notification history, device management.
- **Phase 9 — Admin web**: `apps/admin-web` (Next.js App Router) — full
  business management: dashboard, orders, products (variants, add-ons,
  images, branch availability), inventory (restock/adjust/wastage),
  customers, staff & role/permission management, payment reconciliation
  reports. See ADR-020/021 for its auth architecture and the small
  backend additions (an admin customers endpoint) it needed.

Delivery, coupons, reviews, and the kitchen PWA are built out phase by
phase from here.
