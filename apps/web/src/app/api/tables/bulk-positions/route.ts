/**
 * PATCH /api/tables/bulk-positions
 *
 * Drag & drop multi-table : un seul appel pour repositionner N tables.
 * Émet 'tables_repositioned' aux autres clients.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';
import { publishLiveEvent } from '@/lib/live/publisher';

const Schema = z.object({
  tables: z
    .array(
      z.object({
        id: z.string().uuid(),
        x: z.number().int(),
        y: z.number().int(),
        rotation: z.number().int().optional(),
      }),
    )
    .min(1)
    .max(100),
});

export async function PATCH(req: NextRequest) {
  try {
    await requireRole(['admin']);
    const { tables } = Schema.parse(await req.json());

    const updated = await prisma.$transaction(
      tables.map((t) =>
        prisma.tableModel.update({
          where: { id: t.id },
          data: { x: t.x, y: t.y, ...(t.rotation !== undefined ? { rotation: t.rotation } : {}) },
        }),
      ),
    );

    await publishLiveEvent({
      type: 'tables_repositioned',
      tables: updated.map((t) => ({
        id: t.id,
        number: t.number,
        roomId: t.roomId,
        x: t.x,
        y: t.y,
        rotation: t.rotation,
        status: t.status,
        currentMatchId: t.currentMatchId,
      })),
    });

    return NextResponse.json({ updated: updated.length });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}
