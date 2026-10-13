#!/usr/bin/env bash
# Starts plain PostgreSQL (16 or later) on port 54322, the same port the
# Supabase CLI uses, and rebuilds the "postgres" database from scratch:
# a small Supabase stand-in, then every migration in order.
#
# Use this only where Docker isn't available. Normally run `supabase start`
# (see docs/setup.md). The database tests then work the same way:
#
#   scripts/db/reset-without-docker.sh && pnpm test:db
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
DATA="${PGDATA_DIR:-$ROOT/.local/pgdata}"
PORT="${PGPORT:-54322}"
URL="postgresql://postgres@127.0.0.1:$PORT"
export PGOPTIONS="-c client_min_messages=warning"

if [ -z "$PGBIN" ] || [ ! -x "$PGBIN/postgres" ]; then
  echo "PostgreSQL server not found. Set PGBIN to its bin directory." >&2
  exit 1
fi

# PostgreSQL refuses to run as root, so use the postgres user when we're root.
as_pg() {
  if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi
}

if [ ! -f "$DATA/PG_VERSION" ]; then
  mkdir -p "$DATA"
  if [ "$(id -u)" = "0" ]; then chown postgres "$DATA"; fi
  chmod 700 "$DATA"
  as_pg "$PGBIN/initdb" -D "$DATA" -U postgres --auth=trust --encoding=UTF8 --locale=C.UTF-8 >/dev/null
fi

if ! as_pg "$PGBIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
  as_pg "$PGBIN/pg_ctl" -D "$DATA" -o "-p $PORT -k /tmp -c listen_addresses=127.0.0.1" \
    -l "$DATA/server.log" -w start >/dev/null
fi

psql -q -v ON_ERROR_STOP=1 "$URL/template1" \
  -c "drop database if exists postgres with (force)" \
  -c "create database postgres"

psql -q -v ON_ERROR_STOP=1 "$URL/postgres" -f "$ROOT/scripts/db/vanilla-postgres-shim.sql"
for migration in "$ROOT"/supabase/migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 "$URL/postgres" -f "$migration"
done

echo "Database ready at postgresql://postgres:postgres@127.0.0.1:$PORT/postgres"
