/**
 * Singleton Redis (ioredis) — partagé entre publisher live, FFTT cache, BullMQ.
 */

import IORedis from 'ioredis';

declare global {
  // eslint-disable-next-line no-var
  var __ttRedis: IORedis | undefined;
}

function createRedis(): IORedis {
  const url = process.env.REDIS_URL || 'redis://localhost:6379';
  return new IORedis(url, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });
}

export const redis: IORedis = globalThis.__ttRedis ?? createRedis();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__ttRedis = redis;
}
