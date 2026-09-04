#!/usr/bin/env bash
# Restores a pg_dump custom-format archive (see backup-postgres.sh) into
# a NEW, empty database — never directly over an existing one, so a bad
# restore can't destroy a database that still had good data. Point
# TARGET_DATABASE_URL at a freshly created, empty database.
#
# Same version-matching note as backup-postgres.sh: set
# PG_DOCKER_CONTAINER to run pg_restore inside that container instead
# of the host's client, when they don't match.
#
# Usage:
#   TARGET_DATABASE_URL=postgresql://user:pass@host:port/restore_target \
#     ./restore-postgres.sh /path/to/shri-anandam-20260904T020000Z.dump
#   PG_DOCKER_CONTAINER=shri-anandam-postgres TARGET_DATABASE_URL=... \
#     ./restore-postgres.sh /path/to/shri-anandam-20260904T020000Z.dump
#
# This is the exact procedure verified live during Phase 12 (see
# docs/deployment/backup-restore.md) — pg_dump the real dev database,
# restore into a scratch database, and confirm row counts plus a
# content checksum on the orders table matched exactly before the
# scratch database was dropped.

set -euo pipefail

dump_file="${1:?Usage: restore-postgres.sh <dump-file>}"
: "${TARGET_DATABASE_URL:?TARGET_DATABASE_URL must be set — point this at an empty database, never the live one}"

if [ ! -f "$dump_file" ]; then
  echo "ERROR: $dump_file does not exist" >&2
  exit 1
fi

echo "[$(date -u +%FT%TZ)] Restoring $dump_file -> $TARGET_DATABASE_URL"

if [ -n "${PG_DOCKER_CONTAINER:-}" ]; then
  container_tmp="/tmp/$(basename "$dump_file")"
  docker cp "$dump_file" "$PG_DOCKER_CONTAINER:$container_tmp"
  docker exec "$PG_DOCKER_CONTAINER" pg_restore --dbname="$TARGET_DATABASE_URL" --no-owner --no-privileges "$container_tmp"
  docker exec "$PG_DOCKER_CONTAINER" rm -f "$container_tmp"
else
  pg_restore --dbname="$TARGET_DATABASE_URL" --no-owner --no-privileges "$dump_file"
fi

echo "[$(date -u +%FT%TZ)] Restore complete. Verify before pointing anything at this database:"
echo "  psql \"\$TARGET_DATABASE_URL\" -c \"SELECT count(*) FROM orders;\""
echo "  # ...and compare against the source database's own count for the same table."
