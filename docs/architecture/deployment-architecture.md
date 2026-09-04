# Deployment Architecture

## CI/CD pipeline (section 60)

`.github/workflows/ci.yml`, triggered on every PR and on push to `main`:

```
Checkout → pnpm install (frozen lockfile)
  → Lint (all packages)
  → Typecheck (all packages)
  → Prisma generate + migrate deploy (against an ephemeral Postgres
    service container)
  → Unit + integration tests (Postgres + Redis service containers)
  → pnpm audit (dependency vulnerability scan)
  → [on push to main] Docker build of the API image
```

Staging/production deploy jobs (push the built image to a registry,
apply the deployment, run smoke tests, and support rollback) are added
in Phase 12 once a target hosting platform is chosen — the pipeline
structure above is already the prerequisite for that.

## Environments (section 61)

| Environment | Purpose | Database | Payment keys |
|---|---|---|---|
| development | Local machine, `docker-compose.yml` | local Postgres container | Razorpay test keys |
| staging | Pre-production verification | separate managed Postgres instance | Razorpay test keys |
| production | Real customers, real money | separate managed Postgres instance, backed up | Razorpay live keys |

No environment shares a database, Redis instance, JWT secret, or payment
credential with another. Local development never touches
staging/production credentials — `.env` is per-developer and gitignored.

## Local development

```bash
cp .env.example .env          # fill in local values (defaults work as-is for docker-compose)
pnpm install
pnpm docker:up                # Postgres + Redis + MinIO
pnpm --filter @shri-anandam/api prisma:migrate
pnpm --filter @shri-anandam/api prisma:seed
pnpm dev:api                  # http://localhost:4000/api/v1, health at /health
```

## Rollback (section 60/79)

Deployments are image-tagged by git SHA; rolling back is redeploying the
previous known-good tag rather than reverting code and rebuilding.
Database migrations are additive-first (add nullable column → backfill →
enforce constraint in a later migration) specifically so a code rollback
never needs a matching destructive schema rollback — this is a rule to
enforce in migration review once the schema starts evolving post-Phase 1,
not yet exercised by the initial migration.

## What's intentionally deferred to Phase 12

Load testing, chaos/failure-scenario testing, WAF/CDN configuration, and
the staging/production deploy jobs themselves are explicitly Phase 12
(Production Hardening) work per the phased plan — building them against
an application that doesn't have Orders/Payments/Catalog yet would be
premature. Document further here as each lands.
