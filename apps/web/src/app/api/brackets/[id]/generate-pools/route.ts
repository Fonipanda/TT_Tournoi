/**
 * POST /api/brackets/:id/generate-pools
 *
 * Génère les matches de poule pour un bracket.
 * Body optionnel : { poolSize: 2 | 3 | 4 } — taille PRIVILÉGIÉE seulement.
 *
 * Sans `poolSize`, la répartition est entièrement automatique. Dans tous les
 * cas une poule compte 2, 3 ou 4 joueurs, et les poules de 2 sont évitées :
 * 32 inscrits → 10 poules (8 de 3 + 2 de 4).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';
import { generatePools } from '@/lib/fftt/engine';
import { publishLiveEvent } from '@/lib/live/publisher';

interface Params { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin']);
    const { id } = await params;
    let poolSize: number | undefined;
    try {
      const body = await req.json();
      if (body?.poolSize && typeof body.poolSize === 'number') {
        poolSize = body.poolSize;
      }
    } catch { /* no body is fine */ }
    const result = await generatePools(id, poolSize);
    await publishLiveEvent({ type: 'pools_generated', bracketId: id });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
