/**
 * POST /api/matches/:id/assign-table
 * Body: { tableId: string }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';
import { publishLiveEvent } from '@/lib/live/publisher';

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
        data: { tableId, version: { increment: 1 } },
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
    return NextResponse.json(result.match);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}
