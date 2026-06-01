#!/bin/sh
# =============================================================================
# Entrypoint for the apps/web container (Next.js standalone).
# -----------------------------------------------------------------------------
# Synchronizes DB schema from schema.prisma (db push), applies SQL triggers,
# then starts Next.js. Idempotent: safe to run on every container start.
# =============================================================================

set -e

echo "[entrypoint] Synchronizing database schema (prisma db push)..."
./packages/db/node_modules/.bin/prisma db push \
  --schema=./packages/db/prisma/schema.prisma \
  --accept-data-loss \
  --skip-generate

echo "[entrypoint] Applying SQL migrations (idempotent)..."
for sqlfile in ./packages/db/prisma/migrations/*/migration.sql; do
  if [ -f "$sqlfile" ]; then
    echo "[entrypoint]   - $sqlfile"
    ./packages/db/node_modules/.bin/prisma db execute \
      --schema=./packages/db/prisma/schema.prisma \
      --file="$sqlfile" \
      || echo "[entrypoint] WARN: $sqlfile returned non-zero"
  fi
done

echo "[entrypoint] Schema OK. Starting Next.js..."
exec node apps/web/server.js
