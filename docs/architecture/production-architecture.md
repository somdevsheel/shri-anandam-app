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

| App | Stack | Talks to |
|---|---|---|
| `apps/customer-mobile` | React Native | API over HTTPS + WebSocket |
| `apps/owner-mobile` | React Native | API over HTTPS, FCM push |
| `apps/admin-web` | Next.js | API over HTTPS + WebSocket |
| `apps/kitchen-web` | Next.js (PWA) | API over HTTPS + WebSocket |

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
- **Metrics**: Prometheus scrape endpoint added alongside the first
  production deployment (Phase 12) — request latency/error histograms,
  queue backlog, DB/Redis latency.
- **Tracing**: OpenTelemetry SDK wired in Phase 12 once there are
  multiple services worth correlating a trace across.
- **Errors**: Sentry (`SENTRY_DSN`) captures unhandled exceptions from
  `GlobalExceptionFilter` in staging/production.

## Backups (section 64)

- PostgreSQL: automated daily base backup + continuous WAL archiving for
  point-in-time recovery, stored off the primary server (managed Postgres
  provider or a separate backup host — never co-located with the
  production DB instance).
- Backup restore is tested on a schedule (not just configured), and
  failures alert the on-call owner — tracked as a Phase 12 CI job
  (`docs/deployment/backup-restore.md`, to be written alongside that
  work).
