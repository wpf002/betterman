#!/usr/bin/env bash
#
# Dumps the database and proves the dump restores.
#
#   pnpm db:backup
#
# Backups land OUTSIDE the repository, in ~/Documents/betterman-backups. They
# contain raw devotional emails and reader accounts, so they must never be
# committed — keeping them out of the working tree makes that structural
# rather than a matter of remembering .gitignore.
#
# This matters more than usual here: the BetterMornings archive was backfilled
# from a mailbox whose app password has since been revoked, so the raw_payloads
# table is currently the only copy of those emails.
set -euo pipefail

CONTAINER="${BETTERMAN_PG_CONTAINER:-betterman-pg}"
DB="${BETTERMAN_DB:-betterman}"
BACKUP_DIR="${BETTERMAN_BACKUP_DIR:-$HOME/Documents/betterman-backups}"
KEEP="${BETTERMAN_BACKUP_KEEP:-10}"

if ! docker inspect "$CONTAINER" >/dev/null 2>&1; then
  echo "Postgres container '$CONTAINER' not found. Is it running?" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP=$(date +%Y%m%d-%H%M%S)
TARGET="$BACKUP_DIR/betterman-$STAMP.dump"

echo "dumping $DB…"
# Custom format: compressed, and restorable table-by-table if ever needed.
docker exec "$CONTAINER" pg_dump -U postgres -d "$DB" -Fc -f /tmp/betterman.dump
docker cp "$CONTAINER:/tmp/betterman.dump" "$TARGET"
docker exec "$CONTAINER" rm -f /tmp/betterman.dump

# A dump nobody has restored is a hope, not a backup.
echo "verifying by restoring into a scratch database…"
docker exec "$CONTAINER" psql -U postgres -tAc "DROP DATABASE IF EXISTS restore_check;" >/dev/null
docker exec "$CONTAINER" psql -U postgres -tAc "CREATE DATABASE restore_check;" >/dev/null
docker cp "$TARGET" "$CONTAINER:/tmp/verify.dump" >/dev/null
docker exec "$CONTAINER" pg_restore -U postgres -d restore_check --no-owner /tmp/verify.dump

FAILED=0
for TABLE in items devotionals raw_payloads scripture_refs sources users; do
  LIVE=$(docker exec "$CONTAINER" psql -U postgres -d "$DB" -tAc "SELECT count(*) FROM $TABLE;")
  COPY=$(docker exec "$CONTAINER" psql -U postgres -d restore_check -tAc "SELECT count(*) FROM $TABLE;")
  if [ "$LIVE" = "$COPY" ]; then
    printf '  %-16s %s\n' "$TABLE" "$LIVE"
  else
    printf '  %-16s live=%s restored=%s  MISMATCH\n' "$TABLE" "$LIVE" "$COPY" >&2
    FAILED=1
  fi
done

docker exec "$CONTAINER" psql -U postgres -tAc "DROP DATABASE restore_check;" >/dev/null
docker exec "$CONTAINER" rm -f /tmp/verify.dump

if [ "$FAILED" -ne 0 ]; then
  echo "restore did not match the live database — treat this dump as suspect" >&2
  exit 1
fi

# Keep the most recent few; older ones are rarely what you want back.
ls -t "$BACKUP_DIR"/betterman-*.dump 2>/dev/null | tail -n "+$((KEEP + 1))" | while read -r OLD; do
  echo "pruning $(basename "$OLD")"
  rm -f "$OLD"
done

echo
echo "verified: $TARGET ($(du -h "$TARGET" | cut -f1))"
