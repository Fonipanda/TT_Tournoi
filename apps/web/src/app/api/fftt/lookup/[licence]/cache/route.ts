/**
 * DELETE /api/fftt/lookup/:licence — vide le cache FFTT pour cette licence
 * Utile après mise à jour des points officiels.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { redis } from '@/lib/redis';

interface Params { params: Promise<{ licence: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { licence } = await params;
  await redis.del(`fftt:player:${licence}`).catch(() => undefined);
  return NextResponse.json({ ok: true, cleared: licence });
}
