# =============================================================================
# Dockerfile — apps/ws (Fastify WebSocket service)
# =============================================================================
# Service léger qui écoute Redis Pub/Sub et diffuse aux clients WS.
# Image finale ~200 Mo (avec tsx au runtime).
# =============================================================================

# ---- 1) builder : install + génère prisma client (utilisé indirectement par @tt/auth)
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl python3 make g++
RUN corepack enable
WORKDIR /app

COPY . .

RUN if [ -f pnpm-lock.yaml ]; then \
      pnpm install --frozen-lockfile; \
    else \
      pnpm install --no-frozen-lockfile; \
    fi

# ---- 2) runner : exécute via tsx (Node + ESM TS loader)
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl tini wget
WORKDIR /app

ENV NODE_ENV=production
ENV WS_PORT=3001
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 ws

# Copie le tout depuis le builder (node_modules + sources)
# C'est moins optimisé mais garantit que tsx + tous les workspaces sont là
COPY --from=builder --chown=ws:nodejs /app /app

USER ws
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:3001/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
# Lancement via le script `dev` qui utilise tsx (mais sans le watch)
CMD ["node", "--import", "tsx/esm", "apps/ws/src/server.ts"]
