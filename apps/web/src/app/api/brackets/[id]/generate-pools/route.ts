/**
 * POST /api/brackets/:id/generate-pools
 *
 * Génère les matches de poule pour un bracket.
 * Le moteur FFTT (`@/lib/fftt/engine`) sera détaillé en L6 ; ici on appelle
 * son point d'entrée et on émet un événement live.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';
import { generatePools } from '@/lib/fftt/engine';
import { publishLiveEvent } from '@/lib/live/publisher';

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin']);
    const { id } = await params;
    const result = await generatePools(id);
    await publishLiveEvent({ type: 'pools_generated', bracketId: id });
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
