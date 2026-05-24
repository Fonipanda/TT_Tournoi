/**
 * GET /api/fftt/lookup/:licence — recherche joueur FFTT (cache Redis 24h).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { lookupFfttPlayer, FfttError } from '@/lib/fftt/client';

interface Params { params: Promise<{ licence: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { licence } = await params;
  try {
    const player = await lookupFfttPlayer(licence);
    return NextResponse.json(player);
  } catch (e) {
    if (e instanceof FfttError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
