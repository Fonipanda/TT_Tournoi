/**
 * GET  /api/rooms?tournamentId=...
 * POST /api/rooms                  (admin)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma, Prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';

export async function GET(req: NextRequest) {
  const tournamentId = req.nextUrl.searchParams.get('tournamentId') ?? undefined;
  const where = tournamentId ? { tournamentId, isActive: true } : { isActive: true };
  const rooms = await prisma.room.findMany({
    where,
    orderBy: { name: 'asc' },
    include: { tables: true, _count: { select: { tables: true } } },
  });
  return NextResponse.json({ data: rooms });
}

const CreateSchema = z.object({
  tournamentId: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  width: z.number().int().min(200).default(800),
  height: z.number().int().min(200).default(500),
  entranceMarkers: z.array(z.unknown()).default([]),
  buvetteMarkers: z.array(z.unknown()).default([]),
  wcMarkers: z.array(z.unknown()).default([]),
  arrowMarkers: z.array(z.unknown()).default([]),
  rotation: z.number().int().default(0),
});

export async function POST(req: NextRequest) {
  try {
    await requireRole(['admin']);
    const body = CreateSchema.parse(await req.json());
    const created = await prisma.room.create({
      data: {
        ...body,
        entranceMarkers: body.entranceMarkers as Prisma.InputJsonValue,
        buvetteMarkers: body.buvetteMarkers as Prisma.InputJsonValue,
        wcMarkers: body.wcMarkers as Prisma.InputJsonValue,
        arrowMarkers: body.arrowMarkers as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}
