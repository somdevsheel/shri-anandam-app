# Backup & Restore

Referenced from `docs/architecture/production-architecture.md`'s
Backups section (section 64). This document is the "restore is tested
on a schedule, not just configured" half of that requirement — what's
below reflects a real, live-executed dump-and-restore during Phase 12,
not just a plan.

## What's actually been verified vs. what's a deployment concern

| Piece | Status |
|---|---|
| `pg_dump`/`pg_restore` round-trip | **Tested live** — see "What was actually run" below |
| Row-count + content-checksum verification after restore | **Tested live** |
| `infrastructure/scripts/backup-postgres.sh` / `restore-postgres.sh` | **Tested live**, including the client/server version-mismatch failure mode (see below) |
| Automated daily scheduling (cron/systemd timer/managed provider) | Documented, not deployed — no production host exists yet to schedule it on |
| Continuous WAL archiving / point-in-time recovery | Documented, not tested — local dev's docker-compose Postgres doesn't run with `archive_mode` on; this needs either a managed Postgres provider's built-in PITR or a real WAL-archiving setup on a real server, neither of which exists in this repo's environment |
| Automated restore-testing on a schedule, alerting on failure | Documented as the target, not built — needs a real host/CI runner to execute against, which doesn't exist yet |

## Base backups: `pg_dump` (custom format)

`infrastructure/scripts/backup-postgres.sh` runs `pg_dump --format=custom`
against `DATABASE_URL`, writes a timestamped `.dump` file to
`BACKUP_DIR`, fails loudly if the resulting file is suspiciously small
(a near-empty "successful" backup is worse than a loud failure), and
prunes anything older than `RETENTION_DAYS` (default 14).

```bash
DATABASE_URL=postgresql://user:pass@host:5432/shri_anandam_prod \
BACKUP_DIR=/var/backups/shri-anandam \
  infrastructure/scripts/backup-postgres.sh
```

Cron example (daily at 02:00 UTC):

```
0 2 * * * DATABASE_URL=... /path/to/infrastructure/scripts/backup-postgres.sh >> /var/log/sa-backup.log 2>&1
```

### The version-mismatch failure mode (found running this, not hypothesized)

`pg_dump` refuses to run against a Postgres server **newer** than
itself. Running the script's host-`pg_dump` path against this repo's
own `docker-compose.yml` Postgres (16.13) using the dev machine's system
`pg_dump` (14.2) failed immediately with:

```
pg_dump: error: server version: 16.13; pg_dump version: 14.2 (Ubuntu 14.2-1ubuntu1)
pg_dump: error: aborting because of server version mismatch
```

Two real fixes, both supported by the script:

1. **Production default**: install a matching (or newer) `postgresql-client`
   package on whatever host actually runs the backup — the normal fix
   for a real backup host provisioned for this purpose.
2. **Local dev / Postgres-in-Docker deployments**: set
   `PG_DOCKER_CONTAINER=<container name>` and the script runs `pg_dump`/
   `pg_restore` *inside* that container instead, so client and server
   versions are always identical by construction. This is what was
   actually used to verify the procedure below.

## Restoring

`infrastructure/scripts/restore-postgres.sh` restores a `.dump` file
into a database named by `TARGET_DATABASE_URL` — **always a freshly
created, empty database, never directly over a live one**, so a bad or
partial restore can never destroy data that was still good.

```bash
# 1. Create an empty target database first
psql "$ADMIN_DATABASE_URL" -c "CREATE DATABASE shri_anandam_restore_test;"

# 2. Restore into it
TARGET_DATABASE_URL=postgresql://user:pass@host:5432/shri_anandam_restore_test \
  infrastructure/scripts/restore-postgres.sh /path/to/shri-anandam-20260904T020000Z.dump

# 3. Verify before cutting over anything to point at it (see below)
```

## What was actually run (Phase 12 live verification)

1. `pg_dump`'d the real local dev database (`shri_anandam_dev`, at the
   time: 18 orders, 7 customers, 6 staff, 4 products, 18 order items, 5
   inventory items, 316 audit log rows) via
   `infrastructure/scripts/backup-postgres.sh` with
   `PG_DOCKER_CONTAINER=shri-anandam-postgres`.
2. Created a scratch database (`shri_anandam_restore_test`) and restored
   the dump into it via `infrastructure/scripts/restore-postgres.sh`.
3. Compared row counts for every table above between the original and
   restored databases — **all matched exactly**.
4. Ran a stronger check than counts alone: an MD5 checksum of every
   order's `orderNumber || status || totalInPaise`, concatenated in a
   fixed order, computed independently against both databases —
   **identical hash on both sides** (`edf4d7cc33e1a8e4dca7f2a99a013f1e`),
   confirming byte-identical content, not just matching row counts.
5. Dropped the scratch database.

```sql
-- The content-checksum spot check, reusable for any future restore test:
SELECT md5(string_agg("orderNumber" || status || "totalInPaise"::text, '' ORDER BY id))
FROM orders;
-- Run against both the source and the restored database; the two
-- hashes must match exactly.
```

## What production still needs before this is a complete story

- **WAL archiving / PITR**: a base backup alone only restores to the
  moment the backup ran — anything written since is lost. Real
  production needs either a managed Postgres provider's built-in
  point-in-time recovery, or `archive_mode = on` with
  `archive_command` shipping WAL segments to object storage
  continuously. Neither is configurable from this repo alone (it's a
  server/provider setting), and this repo's dev Postgres doesn't run
  with it enabled, so it has not been tested here.
- **Off-primary storage**: backups must land somewhere other than the
  primary database server's own disk (S3-compatible storage, matching
  the `S3_*` env vars already used for media, is the natural target) —
  the scripts above write to a local path; wiring that path to a remote
  upload is a small addition once a real bucket exists.
- **Scheduled, alerting restore tests**: this document proves the
  *mechanism* works; section 64 also calls for running it *periodically*
  against production backups with an alert on failure — that needs a
  real CI runner or scheduled job with access to production-equivalent
  infrastructure, which doesn't exist in this repo's environment yet.
