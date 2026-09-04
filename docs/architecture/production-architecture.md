# Production Architecture

## System overview

```
Internet
  │
  ▼
DNS / Cloudflare (CDN + WAF)
  │
  ▼
Load Balancer (TLS termination)
  │
  ├──► Nginx (reverse proxy, static asset caching)
  │      │
  │      ▼
  ├──► API instances (services/api, N replicas, stateless)
  │      │            │
  │      │            └──► Realtime gateway (WebSocket, same process in
  │      │                 Phase 1; extractable to its own instance group
  │      │                 later — see section 67 of the brief)
  │      ▼
  ├──► PostgreSQL (primary + read replica once needed) — private network only
  ├──► Redis (cache, OTP, rate limiting, Streams) — private network only
  ├──► Object storage (S3-compatible) — product images, receipts
  └──► Workers (services/worker, services/notification-worker) — consume
       the outbox/queue, never receive inbound HTTP traffic directly
```

Applications:

| App | Stack | Talks to | Domain |
|---|---|---|---|
| `apps/customer-mobile` | React Native | API over HTTPS + WebSocket | — (native app, no hosting) |
| `apps/owner-mobile` | React Native | API over HTTPS, FCM push | — (native app, no hosting) |
| `apps/admin-web` | Next.js | API over HTTPS + WebSocket | `admin.shrianandamsweets.in` |
| `apps/kitchen-web` | Next.js (PWA) | API over HTTPS + WebSocket | `kitchen.shrianandamsweets.in` |
| `services/api` | NestJS | — | `api.shrianandamsweets.in` |

3 subdomains of the existing `shrianandamsweets.in` domain — the main
website itself is untouched. See `docs/deployment/domain-and-dns.md`
for the DNS records, Nginx config, and TLS setup.

## Statelessness (section 66)

API instances hold no session state in process memory:

- Auth is JWT access tokens (self-contained) + refresh tokens persisted
  in PostgreSQL (`sessions` table), so any instance can validate/rotate
  any user's token.
- Idempotency keys, OTPs, and rate-limit counters live in Redis, shared
  across instances.
- Uploaded media goes to S3-compatible object storage, never local disk.

This means the API can run N replicas behind the load balancer with no
sticky-session requirement, and an instance can be killed and replaced
without losing in-flight user sessions.

## Private networking (section 65)

PostgreSQL and Redis are **never** exposed to the public internet — they
sit on a private subnet/VPC reachable only from the API and worker
instances. `docker-compose.yml` binds them to `127.0.0.1` for local dev
only; the equivalent production rule is a security-group/firewall policy
that allows inbound 5432/6379 only from the application layer's subnet.

## Environments (section 61)

Three fully separate environments — development, staging, production —
each with its own database, Redis instance, payment gateway credentials
(test vs live keys), object storage bucket, and FCM project. Nothing in
`.env.example` contains a real value; production secrets are injected via
the deployment platform's secret manager / GitHub Actions encrypted
secrets, never committed.

## Scaling posture (section 67)

Phase 1–11 ship a single well-modularized NestJS application
(`services/api`) rather than microservices — the brief explicitly warns
against premature splitting. The modules most likely to need independent
scaling later are already isolated behind their own Nest modules so they
can be extracted without a rewrite:

- **Notification delivery** — already a separate deployable
  (`services/notification-worker`) from Phase 1's directory layout, even
  though it's not implemented until Phase 8.
- **Realtime gateway** — WebSocket connections are stateful and scale
  differently from REST traffic; it's a self-contained Nest module so it
  can move to its own instance group behind a dedicated load-balancer
  rule if connection counts justify it.
- **Search** — starts on PostgreSQL full-text search (section 51)
  behind a `SearchProvider` interface so OpenSearch can be swapped in
  without changing calling code.

## Observability (section 46)

- **Health**: `/live` (process up), `/ready` (DB + Redis reachable),
  `/health` (both, human-readable) — see `services/api/src/health`.
- **Logs**: structured JSON via `nestjs-pino`, one line per request with
  `requestId`, `method`, `url`, `status`, latency; sensitive fields
  redacted (see `docs/architecture/security-architecture.md`).
- **Metrics**: `GET /metrics` (Prometheus text exposition format,
  `services/api/src/metrics`) — request latency/count histograms
  (labeled by route *pattern*, not raw URL, to avoid unbounded
  cardinality), `outbox_pending_events`/`inventory_active_reservations`
  queue-backlog gauges, plus Node's own process/GC/event-loop metrics
  via `prom-client`'s `collectDefaultMetrics()`. `@Public()` (no JWT —
  a scraper has none to present) but, like the health endpoints, this
  is meant to sit behind the same private-network restriction section
  65 already describes for Postgres/Redis, not additional
  application-layer auth. Verified live, including cross-checking its
  own numbers against an independent client-side load-test measurement
  — see `docs/deployment/load-testing.md`.
- **Tracing**: OpenTelemetry deliberately **not** wired yet, even
  though Phase 12 is complete — `services/api` and
  `services/notification-worker` are the only two services that exist,
  and this repo has no OTLP collector available anywhere to verify a
  real exporter against (`OTEL_EXPORTER_OTLP_ENDPOINT` in `.env.example`
  points at a local default that was never actually running). Wiring
  the SDK without anything to confirm it against would be exactly the
  kind of unverified "looks done" work this project's own standard
  rejects — left as explicit future work for whoever has a real
  collector to point it at, not silently skipped.
- **Errors**: Sentry (`services/api/src/sentry.ts`) captures unhandled
  exceptions from `GlobalExceptionFilter` — only the genuinely-
  unexpected-error branch, not application-level 4xx errors. A no-op
  everywhere `SENTRY_DSN` is unset (every environment this repo can
  currently run in — no Sentry project provisioned), verified live to
  not itself throw or destabilize the request path when a real
  unhandled exception occurred during Phase 12's database-outage
  failure test (see `docs/deployment/failure-testing.md`).

## Backups (section 64)

- PostgreSQL: `infrastructure/scripts/backup-postgres.sh` /
  `restore-postgres.sh` — `pg_dump`/`pg_restore` in custom format, with
  a documented, **live-tested** procedure in
  `docs/deployment/backup-restore.md` (row counts plus a content
  checksum verified identical after a real restore into a scratch
  database).
- Not yet built: continuous WAL archiving/point-in-time recovery (a
  server/provider-level setting, not something this repo's scripts can
  add on their own — see the backup doc's "what's still needed"
  section), off-primary backup storage wiring (the mechanism exists,
  needs a real bucket to point at), and scheduled/alerting automated
  restore tests (needs a real host or CI runner with
  production-equivalent access, which doesn't exist yet).
