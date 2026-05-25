/**
 * Service Fastify WebSocket — écoute /api/ws/live + /health.
 *
 * Port d'écoute par défaut : 3001 (configurable via WS_PORT).
 * Coolify proxifie tournoi-chellestt.fr/ws → ce service.
 *
 * L'authentification est OPTIONNELLE :
 *  - sans token : rôle 'visitor' (peut recevoir tous les events publics)
 *  - avec token JWT valide en query string ?token=... : rôle authentifié
 *
 * On ne déconnecte PAS les visitors : tous les events live sont publics
 * (résultats de matchs affichés en gymnase). Le token sert uniquement
 * à logger et à éventuellement filtrer plus tard.
 */

import Fastify from 'fastify';
import websocket, { type SocketStream } from '@fastify/websocket';
import { verifyAccessToken } from '@tt/auth/jwt';
import type { Role } from '@tt/types';
import { Broadcaster } from './broadcaster';
import { startRedisSubscriber } from './redis-subscriber';

const PORT = Number(process.env.WS_PORT ?? 3001);
const HOST = '0.0.0.0';

async function main() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
    trustProxy: true,
  });

  await app.register(websocket, {
    options: { maxPayload: 1024 * 64 }, // 64 Ko (largement assez pour les events)
  });

  const broadcaster = new Broadcaster();
  const subscriber = await startRedisSubscriber(broadcaster);

  // ---- Healthcheck (Coolify) ----
  app.get('/health', async () => {
    return {
      ok: true,
      uptime: Math.floor(process.uptime()),
      connections: broadcaster.size(),
      stats: broadcaster.stats(),
    };
  });

  // ---- WebSocket endpoint ----
  app.register(async (fastify) => {
    fastify.get(
      '/api/ws/live',
      { websocket: true },
      async (connection: SocketStream, req) => {
        const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
        const token = url.searchParams.get('token');

        let role: Role = 'visitor';
        let userId: string | undefined;

        if (token) {
          try {
            const claims = await verifyAccessToken(token);
            role = claims.role;
            userId = claims.sub;
          } catch {
            // token invalide → on garde 'visitor' (pas de déco)
          }
        }

        const client = broadcaster.add(connection.socket, role);

        // Hello initial
        try {
          connection.socket.send(
            JSON.stringify({
              type: 'hello',
              role,
              serverTime: new Date().toISOString(),
            }),
          );
        } catch {
          /* ignore */
        }

        if (userId) {
          fastify.log.info({ userId, role }, 'ws.connect');
        }

        connection.socket.on('close', () => {
          broadcaster.remove(client);
        });
        connection.socket.on('error', () => {
          broadcaster.remove(client);
        });

        // Ping périodique (keep-alive 25s — < 30s qui est le timeout typique
        // des proxies/load-balancers comme Traefik/Nginx)
        const ping = setInterval(() => {
          if (connection.socket.readyState === 1) {
            try {
              connection.socket.ping();
            } catch {
              /* ignore */
            }
          } else {
            clearInterval(ping);
          }
        }, 25_000);
        connection.socket.on('close', () => clearInterval(ping));
      },
    );
  });

  // ---- Graceful shutdown ----
  const shutdown = async (signal: string) => {
    app.log.info(`[ws] ${signal} received, shutting down…`);
    try {
      await subscriber.quit();
    } catch {
      /* ignore */
    }
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: HOST, port: PORT });
  app.log.info(`[ws] WebSocket service ready on ${HOST}:${PORT}`);
}

main().catch((err) => {
  console.error('[ws] fatal:', err);
  process.exit(1);
});
