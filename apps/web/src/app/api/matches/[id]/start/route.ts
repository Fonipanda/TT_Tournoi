/**
 * POST /api/matches/:id/start — passe waiting → in_progress
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';
import { publishLiveEvent } from '@/lib/live/publisher';

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin', 'juge_arbitre']);
    const { id } = await params;
    const m = await prisma.match.update({
      where: { id },
      data: {
        status: 'in_progress',
        startTime: new Date(),
        version: { increment: 1 },
      },
      include: { player1: true, player2: true, table: true },
    });
    await publishLiveEvent({
      type: 'match_started',
      match: {
        id: m.id,
        bracketId: m.bracketId,
        player1: m.player1,
        player2: m.player2,
        tableId: m.tableId,
        tableNumber: m.table?.number ?? null,
        status: m.status,
        scoreP1: m.scoreP1,
        scoreP2: m.scoreP2,
        setsP1: m.setsP1,
        setsP2: m.setsP2,
        version: m.version,
      },
    });
    return NextResponse.json(m);
  } catch (e) {
    return errorResponse(e);
  }
}
