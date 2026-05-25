# =============================================================================
# Dockerfile — apps/ws (Fastify WebSocket service)
# =============================================================================
# Service léger qui écoute Redis Pub/Sub et diffuse aux clients WS.
# Image finale ~150 Mo.
# =============================================================================

# ---- 1) deps
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable
WORKDIR /app

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

RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm install --frozen-lockfile; \
    else \
      pnpm install --no-frozen-lockfile; \
    fi

# ---- 2) builder
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# tsx peut runner directement le TS, mais on compile pour le runner
RUN pnpm --filter @tt/ws build || true

# ---- 3) runner
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl tini
WORKDIR /app

ENV NODE_ENV=production
ENV WS_PORT=3001
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 ws

# Copie les node_modules nécessaires + le code source
# (on utilise tsx en runtime pour éviter la compilation TS dans le builder)
COPY --from=deps --chown=ws:nodejs /app/node_modules ./node_modules
COPY --chown=ws:nodejs apps/ws ./apps/ws
COPY --chown=ws:nodejs packages/auth ./packages/auth
COPY --chown=ws:nodejs packages/types ./packages/types
COPY --chown=ws:nodejs packages/config ./packages/config
COPY --chown=ws:nodejs package.json pnpm-workspace.yaml turbo.json ./

USER ws
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3001/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--import", "tsx/esm", "apps/ws/src/server.ts"]
