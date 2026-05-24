/**
 * Publisher d'événements live → Redis Pub/Sub.
 *
 * Le service Fastify (apps/ws) écoute le pattern `live:*` et rebroadcaste
 * aux clients WebSocket. Chaque mutation REST critique (PATCH match,
 * bulk-positions tables, etc.) appelle `publishLiveEvent`.
 */

import type { LiveEvent } from '@tt/types';
import { LIVE_CHANNEL_PREFIX } from '@tt/types';
import { redis } from '../redis.js';

export async function publishLiveEvent(event: LiveEvent): Promise<void> {
  const channel = LIVE_CHANNEL_PREFIX + event.type;
  try {
    await redis.publish(channel, JSON.stringify(event));
  } catch (err) {
    // Pub/Sub down ne doit jamais bloquer la mutation principale
    console.error('[live] publish failed:', err);
  }
}
