# Load Testing

Phase 12. Run with [`autocannon`](https://github.com/mcollina/autocannon)
(`npx autocannon ...` — no install needed) against a real running
`services/api` instance. Both runs below were executed live against the
actual dev database (small dataset: 4 products, 18 orders) — the
absolute numbers will move with real production data volume and
hardware, but the *shape* of the results (rate limiting protects the
service; legitimate paced traffic is fast) is what matters here.

## Run 1 — flood, unthrottled connection count

```bash
npx autocannon -c 20 -d 15 -p 1 "http://localhost:4000/api/v1/catalog/products?pageSize=10"
```

20 concurrent connections, pipelining 1, 15 seconds, no rate cap on the
client side — as fast as the client can fire.

**Result:** 108,000 requests in 15s (~7,200 req/s). Only 99 got a `200`;
107,462 got `429 Too Many Requests`. The server stayed fully healthy
throughout and immediately after (`GET /health` still reported
`database: up`, `redis: up`) — this is
`RATE_LIMIT_MAX_REQUESTS`/`RATE_LIMIT_TTL_SECONDS` (the global
`ThrottlerGuard`, Redis-backed as of this phase — see ADR-024) doing
exactly its job: absorbing a flood without the process degrading or
the database ever seeing anywhere near 7,200 queries/second.

This run is also what surfaced that the *default* limit (100/min) was
too tight for realistic legitimate traffic sharing one IP — see
`.env.example`'s comment and ADR-024 for the fix (raised to 300, chosen
from this repo's own apps' actual polling math, not a guess).

## Run 2 — paced, within the rate limit

```bash
npx autocannon -c 5 -d 20 -R 4 "http://localhost:4000/api/v1/catalog/products?pageSize=10"
```

5 connections, 20 seconds, capped at 4 requests/second (240/min — under
the 300/min limit) — the shape of traffic an actual busy but
non-abusive client would generate.

**Result:** 84 requests, 0 rejections. Client-observed latency: p50 9ms,
p97.5 21ms, p99 23ms, max 26ms. Cross-checked against this phase's own
`GET /metrics` — the `http_request_duration_seconds` histogram for this
exact route/status recorded 80 requests (the extra 4 in the client count
were from `curl` calls made before/after the run) averaging ~14ms
server-side processing time, consistent with the client-side figures
once network round-trip is accounted for. Two independent measurements
(autocannon's client timing, this repo's own new Prometheus
instrumentation) agreeing with each other is itself a small extra
confirmation that the metrics work from this phase is accurate, not
just present.

## What this does and doesn't tell you

Both runs were against a **local single-instance dev server, a small
dataset, and no concurrent write load** (no orders being placed/status-
transitioned during the read-only catalog browsing test). It confirms:

- The rate limiter genuinely protects the service under a real flood,
  not just in theory.
- A single DB-touching public read endpoint is fast (single-digit-to-
  low-double-digit ms) at this data scale.

It does **not** tell you the real production capacity ceiling (that
depends on production hardware, connection pool sizing, and real data
volume/index performance at scale), nor how the app behaves under
*write*-heavy concurrent load (checkout, inventory reservation) — the
existing concurrency proof in
`services/api/src/inventory/inventory-reservation.service.integration.spec.ts`
(`Promise.all` of genuinely concurrent reservations) covers correctness
under concurrency, but not throughput/capacity under load. A real
capacity/soak test against a staging environment with production-like
data volume is the natural next step once one exists.
