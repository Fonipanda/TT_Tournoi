/**
 * POST /api/matches/:id/assign-table
 * Body: { tableId: string }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';
import { publishLiveEvent } from '@/lib/live/publisher';
import { notifySms } from '@/lib/sms/notify';

interface Params { params: Promise<{ id: string }> }

const Schema = z.object({ tableId: z.string().uuid() });

export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin', 'juge_arbitre']);
    const { id } = await params;
    const { tableId } = Schema.parse(await req.json());

    const result = await prisma.$transaction(async (tx) => {
      const table = await tx.tableModel.update({
        where: { id: tableId },
        data: { status: 'occupied', currentMatchId: id },
      });
      const match = await tx.match.update({
        where: { id },
        data: {
          tableId,
          status: 'in_progress',
          startTime: new Date(),
          version: { increment: 1 },
        },
      });
      return { table, match };
    });

    await publishLiveEvent({
      type: 'table_updated',
      table: {
        id: result.table.id,
        number: result.table.number,
        roomId: result.table.roomId,
        x: result.table.x,
        y: result.table.y,
        rotation: result.table.rotation,
        status: result.table.status,
        currentMatchId: result.table.currentMatchId,
      },
    });

    // Appel à la table : SMS aux deux joueurs. Hors transaction et non bloquant.
    const detail = await prisma.match.findUnique({
      where: { id },
      include: {
        bracket: true,
        player1: true,
        player2: true,
        table: { include: { room: true } },
      },
    });

    if (detail) {
      const label = (p: { lastName: string; firstName: string } | null) =>
        p ? `${p.lastName} ${p.firstName}` : '';
      await notifySms(
        'table_assigned',
        [detail.player1Id, detail.player2Id],
        (playerId) => ({
          joueur: label(playerId === detail.player1Id ? detail.player1 : detail.player2),
          adversaire: label(playerId === detail.player1Id ? detail.player2 : detail.player1),
          table: detail.table?.number ?? '',
          salle: detail.table?.room?.name ?? '',
          tableau: detail.bracket?.name ?? '',
        }),
      );
    }

    return NextResponse.json(result.match);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}
