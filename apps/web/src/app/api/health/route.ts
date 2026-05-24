/**
 * GET /api/health — Healthcheck DB + Redis (utilisé par Coolify).
 */

import { NextResponse } from 'next/server';
import { prisma } from '@tt/db';
import { redis } from '@/lib/redis';
import type { HealthCheckResponse } from '@tt/types';

export async function GET() {
  let db: 'up' | 'down' = 'down';
  let redisStatus: 'up' | 'down' = 'down';

  try {
    await prisma.$queryRaw`SELECT 1`;
    db = 'up';
  } catch {
    /* down */
  }
  try {
    const pong = await redis.ping();
    if (pong === 'PONG') redisStatus = 'up';
  } catch {
    /* down */
  }

  const ok = db === 'up' && redisStatus === 'up';
  const body: HealthCheckResponse = {
    ok,
    uptime: Math.floor(process.uptime()),
    services: { db, redis: redisStatus },
    version: process.env.npm_package_version ?? '2.0.0-dev',
  };
  return NextResponse.json(body, { status: ok ? 200 : 503 });
}
