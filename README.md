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

## Common commands

```bash
pnpm lint            # eslint across every package
pnpm typecheck        # tsc --noEmit across every package
pnpm test             # jest across every package
pnpm build            # build every package/service
pnpm prisma:studio    # browse the local database
```

## Status

**Phase 1 (Foundation) is in place**: monorepo, TypeScript, NestJS API
skeleton, PostgreSQL schema (Prisma) covering the full data model, Redis,
JWT auth (customer OTP + staff password) with refresh-token rotation,
RBAC enforced via a global permissions guard, structured logging,
global error handling, health checks, Docker, CI. Catalog, Cart, Orders,
Payments, Inventory, Admin/Kitchen UIs, and the mobile apps are built out
phase by phase from here — see section 76 of the project brief and the
phase list it defines.
