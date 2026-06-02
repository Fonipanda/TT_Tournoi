/**
 * GET    /api/rooms/:id
 * PATCH  /api/rooms/:id        (admin) — édition canvas + marqueurs
 * DELETE /api/rooms/:id
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma, Prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const r = await prisma.room.findUnique({
    where: { id },
    include: { tables: true },
  });
  if (!r) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  return NextResponse.json(r);
}

const UpdateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  entranceMarkers: z.array(z.unknown()).optional(),
  buvetteMarkers: z.array(z.unknown()).optional(),
  wcMarkers: z.array(z.unknown()).optional(),
  arrowMarkers: z.array(z.unknown()).optional(),
  rotation: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin']);
    const { id } = await params;
    const body = UpdateSchema.parse(await req.json());
    const data: Record<string, unknown> = { ...body };
    for (const key of ['entranceMarkers', 'buvetteMarkers', 'wcMarkers', 'arrowMarkers'] as const) {
      if (body[key] !== undefined) data[key] = body[key] as Prisma.InputJsonValue;
    }
    const updated = await prisma.room.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin']);
    const { id } = await params;
    const hard = req.nextUrl.searchParams.get('hard') === 'true';
    if (hard) {
      await prisma.$transaction([
        prisma.tableModel.deleteMany({ where: { roomId: id } }),
        prisma.room.delete({ where: { id } }),
      ]);
    } else {
      await prisma.$transaction([
        prisma.tableModel.deleteMany({ where: { roomId: id } }),
        prisma.room.update({ where: { id }, data: { isActive: false } }),
      ]);
    }
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
