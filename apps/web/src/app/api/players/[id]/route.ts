/**
 * GET    /api/players/:id
 * PATCH  /api/players/:id        (admin ou player lui-même)
 * DELETE /api/players/:id        (admin)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { errorResponse, getCurrentUser, HttpError, requireRole } from '@/lib/auth/server';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const p = await prisma.player.findUnique({
    where: { id },
    include: {
      registrations: { include: { bracket: true } },
    },
  });
  if (!p) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  return NextResponse.json(p);
}

const UpdateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  ranking: z.string().optional(),
  points: z.number().optional(),
  club: z.string().optional(),
  email: z.string().email().or(z.literal('')).optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const me = await getCurrentUser();
    if (!me) throw new HttpError(401, 'Auth requise');
    if (me.role !== 'admin' && me.playerId !== id) {
      throw new HttpError(403, 'Modification interdite');
    }
    const body = UpdateSchema.parse(await req.json());
    const updated = await prisma.player.update({ where: { id }, data: body });
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
    await prisma.player.update({ where: { id }, data: { isActive: false } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
