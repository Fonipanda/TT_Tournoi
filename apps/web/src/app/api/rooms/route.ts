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
    include: {
      tables: {
        orderBy: { number: 'asc' },
        include: {
          matches: {
            where: { status: 'in_progress' },
            take: 1,
            select: {
              setsP1: true,
              setsP2: true,
              player1: { select: { lastName: true, firstName: true } },
              player2: { select: { lastName: true, firstName: true } },
            },
          },
        },
      },
      _count: { select: { tables: true } },
    },
  });

  // Map to include currentMatch on each table
  const data = rooms.map((room) => ({
    ...room,
    tables: room.tables.map((t) => {
      const match = t.matches?.[0] ?? null;
      return {
        id: t.id,
        number: t.number,
        x: t.x,
        y: t.y,
        rotation: t.rotation,
        status: t.status,
        currentMatch: match
          ? {
              player1: match.player1,
              player2: match.player2,
              setsP1: match.setsP1 ?? 0,
              setsP2: match.setsP2 ?? 0,
            }
          : null,
      };
    }),
  }));

  return NextResponse.json({ data });
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
