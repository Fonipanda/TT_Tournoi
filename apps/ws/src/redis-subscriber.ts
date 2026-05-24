/**
 * Subscriber Redis — écoute le pattern `live:*` et diffuse aux clients WS.
 */

import IORedis from 'ioredis';
import type { LiveEvent } from '@tt/types';
import { LIVE_CHANNEL_PATTERN } from '@tt/types';
import type { Broadcaster } from './broadcaster.js';

export async function startRedisSubscriber(broadcaster: Broadcaster): Promise<IORedis> {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  const sub = new IORedis(url, { maxRetriesPerRequest: null });

  await sub.psubscribe(LIVE_CHANNEL_PATTERN);
  sub.on('pmessage', (_pattern, _channel, message) => {
    try {
      const event = JSON.parse(message) as LiveEvent;
      broadcaster.broadcast(event);
    } catch (e) {
      console.warn('[ws] invalid message:', e);
    }
  });
  sub.on('error', (err) => {
    console.error('[ws] redis subscriber error:', err);
  });
  sub.on('end', () => {
    console.warn('[ws] redis subscriber disconnected');
  });

  console.info('[ws] subscribed to', LIVE_CHANNEL_PATTERN);
  return sub;
}
