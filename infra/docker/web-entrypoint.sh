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

echo "[entrypoint] Applying SQL triggers (idempotent)..."
if [ -f ./packages/db/prisma/migrations/0002_triggers/migration.sql ]; then
  ./packages/db/node_modules/.bin/prisma db execute \
    --schema=./packages/db/prisma/schema.prisma \
    --file=./packages/db/prisma/migrations/0002_triggers/migration.sql \
    || echo "[entrypoint] WARN: triggers SQL returned non-zero (may already exist)"
fi

echo "[entrypoint] Schema OK. Starting Next.js..."
exec node apps/web/server.js
