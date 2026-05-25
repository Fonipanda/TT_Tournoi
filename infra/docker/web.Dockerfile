# =============================================================================
# Dockerfile — apps/web (Next.js 15 standalone)
# =============================================================================
# Multi-stage build pour image finale légère (~250 Mo).
# Utilise pnpm workspaces avec @tt/db, @tt/auth, @tt/sms, @tt/types, @tt/ui.
#
# Build : depuis la racine du monorepo
#   docker build -f infra/docker/web.Dockerfile -t tt-web .
# Run :
#   docker run -e DATABASE_URL=... -p 3000:3000 tt-web
# =============================================================================

# ---- 1) builder : install + prisma generate + next build
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl python3 make g++
RUN corepack enable
WORKDIR /app

# Copie tout le contexte du repo
COPY . .

# pnpm install (avec ou sans lockfile)
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm install --frozen-lockfile; \
    else \
      echo "[build] pnpm-lock.yaml absent — generation au premier build"; \
      pnpm install --no-frozen-lockfile; \
    fi

# Génère le client Prisma (binaire local depuis node_modules de packages/db)
RUN pnpm --filter @tt/db run db:generate

# Build Next.js standalone
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @tt/web run build

# ---- 2) runner : image finale minimale
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl tini
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Utilisateur non-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Standalone output Next.js
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Prisma : on a besoin du moteur + schema pour les migrations runtime
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/src/generated ./packages/db/src/generated
COPY --from=builder --chown=nextjs:nodejs /app/packages/db/node_modules ./packages/db/node_modules

# node_modules racine (contient .pnpm/ avec les paquets réels vers lesquels
# pointent les symlinks de packages/db/node_modules/.bin/prisma)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

# Entrypoint qui applique les migrations puis démarre Next.js
COPY --chown=nextjs:nodejs infra/docker/web-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER nextjs
EXPOSE 3000

# Healthcheck Coolify : /api/health
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3000/api/health || exit 1

# tini = init proper qui propage SIGTERM
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/entrypoint.sh"]
