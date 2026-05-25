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

# ---- 1) deps : installe les dépendances mono-repo
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl python3 make g++
RUN corepack enable
WORKDIR /app

# Copie tous les manifests pour permettre à pnpm de résoudre le workspace
# pnpm-lock.yaml* avec wildcard : optionnel (sera généré si absent)
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY pnpm-lock.yaml* ./
COPY apps/web/package.json apps/web/
COPY apps/ws/package.json apps/ws/
COPY packages/db/package.json packages/db/
COPY packages/auth/package.json packages/auth/
COPY packages/sms/package.json packages/sms/
COPY packages/types/package.json packages/types/
COPY packages/ui/package.json packages/ui/
COPY packages/config/package.json packages/config/

# Si pnpm-lock.yaml présent → frozen, sinon → install permissif (1er build)
RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm install --frozen-lockfile; \
    else \
      echo "[build] pnpm-lock.yaml absent — generation au premier build"; \
      pnpm install --no-frozen-lockfile; \
    fi

# ---- 2) builder : génère client Prisma + build Next.js
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Génère le client Prisma (binaire alpine)
# On utilise `cd` + `npx` pour éviter les soucis de résolution de binaires
# avec pnpm workspaces (le binaire prisma est hoisté à la racine).
RUN cd packages/db && npx prisma generate --schema=./prisma/schema.prisma

# Build Next.js standalone
ENV NEXT_TELEMETRY_DISABLED=1
RUN cd apps/web && npx next build

# ---- 3) runner : image finale minimale
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
