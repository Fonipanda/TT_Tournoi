/**
 * GET    /api/matches/:id
 * PATCH  /api/matches/:id        (admin/JA) — update générique
 * DELETE /api/matches/:id        (admin)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const m = await prisma.match.findUnique({
    where: { id },
    include: {
      player1: true,
      player2: true,
      winner: true,
      table: true,
      bracket: true,
      events: { orderBy: { createdAt: 'desc' }, take: 50 },
    },
  });
  if (!m) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  return NextResponse.json(m);
}

const UpdateSchema = z.object({
  player1Id: z.string().uuid().nullable().optional(),
  player2Id: z.string().uuid().nullable().optional(),
  roundName: z.string().optional(),
  poolNumber: z.number().int().nullable().optional(),
  status: z.enum(['waiting', 'in_progress', 'finished', 'blocked']).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin', 'juge_arbitre']);
    const { id } = await params;
    const body = UpdateSchema.parse(await req.json());
    const updated = await prisma.match.update({
      where: { id },
      data: { ...body, version: { increment: 1 } },
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
    await prisma.match.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
