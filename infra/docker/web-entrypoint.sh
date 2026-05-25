#!/bin/sh
# =============================================================================
# Entrypoint for the apps/web container (Next.js standalone).
# -----------------------------------------------------------------------------
# Applies Prisma migrations then starts the Next.js server.
# Fail-fast: if migrations fail, the container exits and Coolify marks it
# as unhealthy.
# =============================================================================

set -e

echo "[entrypoint] Applying Prisma migrations..."
# .bin/prisma is a shell wrapper: invoke it directly (NOT via 'node')
./packages/db/node_modules/.bin/prisma migrate deploy \
  --schema=./packages/db/prisma/schema.prisma

echo "[entrypoint] Migrations OK. Starting Next.js..."
exec node apps/web/server.js
