# Failure Testing

Phase 12. Each scenario below was executed against the real running
`services/api` (dev environment) by stopping the actual Docker container
for that dependency — `docker stop shri-anandam-postgres` /
`docker stop shri-anandam-redis` — not simulated or mocked. Every other
project's containers on the same machine were left untouched throughout
(confirmed via `docker ps` before and after each test).

## PostgreSQL outage

**Setup:** `docker stop shri-anandam-postgres` while the API was already
running and serving traffic.

**Observed:**
- `GET /health` and `GET /ready` correctly returned `503` (Terminus's
  health check correctly reports `database: down`) — an orchestrator's
  readiness probe would correctly stop routing traffic to this instance.
- A real data-touching request (`POST /auth/staff/login`) returned `500`
  with the standard, safe `{"code":"INTERNAL_ERROR","message":"An
  unexpected error occurred"}` body — no stack trace, no connection
  string, no internal detail leaked to the client.
- Server-side, the full Prisma error (`P1001: Can't reach database
  server at localhost:55433`) was logged with a complete stack trace via
  the structured pino logger — an operator has everything needed to
  diagnose it; the client has nothing that could be a vector for
  probing internal infrastructure.
- The Node process itself **did not crash** — it kept accepting
  connections and serving the correct 503/500 responses throughout the
  outage.
- This same run also verified Sentry's error-capture path
  (`GlobalExceptionFilter` → `Sentry.captureException`) is safe with no
  `SENTRY_DSN` configured (every environment this repo can currently
  run in) — the capture call executed as a no-op and did not itself
  throw or crash the request, confirmed by the server continuing to
  respond correctly to subsequent requests.

**Recovery:** `docker start shri-anandam-postgres`, waited for its own
healthcheck to pass (~8s). `GET /health` returned to `database: up`
and a full login request succeeded immediately after — **no restart of
the API process was needed**; Prisma's connection pool reconnected on
its own once the database was reachable again.

## Redis outage

**Setup:** `docker stop shri-anandam-redis` while the API was running.

**Observed:**
- `GET /health` correctly returned `503` (`redis: down`).
- `POST /auth/customer/otp/request` (OTP storage is Redis-backed)
  correctly failed with `500` — safe generic message to the client, full
  detail logged server-side, same shape as the Postgres case.
- **A real gap this test caught**: `POST /auth/staff/login` — a route
  that doesn't itself read/write Redis for the login logic — still
  *succeeded* with Redis fully down, with **no rate-limit enforcement
  applied at all**. `ThrottlerModule` was using its default in-memory
  storage rather than Redis, contradicting this repo's own documented
  architecture (`production-architecture.md`: "rate-limit counters live
  in Redis, shared across instances") and meaning the actual
  in-production behavior wasn't just "silently per-replica" but
  currently fully bypassable by anyone who could make Redis
  unavailable. Fixed within this same phase — see ADR-024. Re-run after
  the fix: staff login now correctly enforces its 5/min limit
  independent of which specific request path within the app "needs"
  Redis for other reasons, since the guard itself now depends on it.

**Recovery:** `docker start shri-anandam-redis`. Confirmed the
Redis-backed throttler key (`{<hash>:default}:hits`) both persists
across requests and expires on the configured TTL as expected — see
ADR-024's own live verification for the exact commands.

## What this does and doesn't cover

Covered live: single-dependency outage (DB alone, Redis alone), and
recovery without a process restart. **Not** covered here (would need a
real multi-replica environment to test meaningfully): a replica-level
failure with a load balancer routing around it, a network partition
between API and DB that isn't a clean "connection refused" (a hung
connection behaves differently from a fast-failing one and is worth a
dedicated test once a real staging environment exists), and Postgres
failover to a read replica (`production-architecture.md`'s "primary +
read replica once needed" is explicitly future work, not built yet).
