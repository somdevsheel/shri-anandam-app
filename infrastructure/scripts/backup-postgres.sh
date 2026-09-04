#!/usr/bin/env bash
# Phase 12 — daily base backup. Takes a pg_dump custom-format archive
# (not a plain SQL dump — pg_restore's -j parallel restore and
# selective table restore both need the custom format) of the database
# named in DATABASE_URL, writes it to BACKUP_DIR with a UTC timestamp,
# and prunes anything older than RETENTION_DAYS.
#
# This script performs the base-backup half of section 64's requirement
# ("automated daily base backup + continuous WAL archiving"). WAL
# archiving for point-in-time recovery is a Postgres server-level
# setting (archive_mode/archive_command, or a managed provider's
# built-in PITR), not something a client-side script can add — see
# docs/deployment/backup-restore.md for how the two fit together and
# what's actually been tested (this script's dump/restore path, live,
# with a checksum verification — WAL/PITR was not, since local dev's
# docker-compose Postgres doesn't run with archive_mode on).
#
# pg_dump refuses to run against a NEWER server than its own version
# (caught live running this script against this repo's own docker-
# compose Postgres 16 with the host's pg_dump 14 — a real, common
# mismatch, not a hypothetical). Two ways to avoid it:
#   1. Install a matching (or newer) postgresql-client package on
#      whatever host actually runs this in production — the normal fix.
#   2. Set PG_DOCKER_CONTAINER to run pg_dump INSIDE that container
#      instead, so the client and server versions are always identical
#      by construction — the practical fix for local dev and any
#      small deployment where Postgres itself runs in Docker.
#
# Usage:
#   DATABASE_URL=postgresql://user:pass@host:port/db ./backup-postgres.sh
#   PG_DOCKER_CONTAINER=shri-anandam-postgres DATABASE_URL=... ./backup-postgres.sh
# Cron:
#   0 2 * * * DATABASE_URL=... /path/to/backup-postgres.sh >> /var/log/sa-backup.log 2>&1

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL must be set}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/shri-anandam}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

mkdir -p "$BACKUP_DIR"

timestamp=$(date -u +%Y%m%dT%H%M%SZ)
dump_file="$BACKUP_DIR/shri-anandam-${timestamp}.dump"

echo "[$(date -u +%FT%TZ)] Starting backup -> $dump_file"

if [ -n "${PG_DOCKER_CONTAINER:-}" ]; then
  # Dump inside the container (matching client/server version by
  # construction), then copy the archive back out to the host.
  container_tmp="/tmp/sa-backup-${timestamp}.dump"
  docker exec "$PG_DOCKER_CONTAINER" pg_dump --dbname="$DATABASE_URL" --format=custom --file="$container_tmp"
  docker cp "$PG_DOCKER_CONTAINER:$container_tmp" "$dump_file"
  docker exec "$PG_DOCKER_CONTAINER" rm -f "$container_tmp"
else
  pg_dump --dbname="$DATABASE_URL" --format=custom --file="$dump_file"
fi

# Fail loudly if the dump is suspiciously small (an empty/near-empty
# file usually means pg_dump connected but the schema was wrong/empty,
# not a real backup) rather than silently "succeeding" with garbage.
size_bytes=$(stat -c%s "$dump_file" 2>/dev/null || stat -f%z "$dump_file")
if [ "$size_bytes" -lt 1024 ]; then
  echo "[$(date -u +%FT%TZ)] ERROR: backup file is suspiciously small (${size_bytes} bytes) — not trusting it" >&2
  exit 1
fi
echo "[$(date -u +%FT%TZ)] Backup complete: ${size_bytes} bytes"

echo "[$(date -u +%FT%TZ)] Pruning backups older than ${RETENTION_DAYS} days"
find "$BACKUP_DIR" -name "shri-anandam-*.dump" -mtime "+${RETENTION_DAYS}" -print -delete

echo "[$(date -u +%FT%TZ)] Done"
