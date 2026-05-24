/**
 * GET    /api/tables/:id
 * PATCH  /api/tables/:id (admin) — édition simple
 * DELETE /api/tables/:id (admin)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';
import { publishLiveEvent } from '@/lib/live/publisher';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const t = await prisma.tableModel.findUnique({ where: { id } });
  if (!t) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  return NextResponse.json(t);
}

const Schema = z.object({
  number: z.number().int().optional(),
  x: z.number().int().optional(),
  y: z.number().int().optional(),
  rotation: z.number().int().optional(),
  status: z.enum(['free', 'occupied', 'maintenance']).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin']);
    const { id } = await params;
    const body = Schema.parse(await req.json());
    const updated = await prisma.tableModel.update({ where: { id }, data: body });
    await publishLiveEvent({
      type: 'table_updated',
      table: {
        id: updated.id,
        number: updated.number,
        roomId: updated.roomId,
        x: updated.x,
        y: updated.y,
        rotation: updated.rotation,
        status: updated.status,
        currentMatchId: updated.currentMatchId,
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin']);
    const { id } = await params;
    await prisma.tableModel.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
