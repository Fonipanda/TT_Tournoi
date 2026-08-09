/**
 * GET  /api/brackets?tournamentId=...
 * POST /api/brackets             (admin)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma, prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';

export async function GET(req: NextRequest) {
  const tournamentId = req.nextUrl.searchParams.get('tournamentId') ?? undefined;
  const where = tournamentId ? { tournamentId } : {};
  const brackets = await prisma.bracket.findMany({
    where,
    // Les tableaux sont systématiquement listés par ordre alphabétique.
    orderBy: { name: 'asc' },
    // Les inscriptions supprimées par l'admin sont désactivées (isActive=false)
    // et non effacées : sans ce filtre le compteur ne redescendrait jamais, et
    // un tableau resterait affiché « complet » après libération des places.
    include: {
      _count: {
        select: { matches: true, registrations: { where: { isActive: true } } },
      },
    },
  });
  return NextResponse.json({ data: brackets });
}

const CreateSchema = z.object({
  tournamentId: z.string().uuid(),
  name: z.string().min(1),
  category: z.string().default(''),
  minPoints: z.number().int().nullable().optional(),
  maxPoints: z.number().int().nullable().optional(),
  maxPlayers: z.number().int().min(2).max(256).default(16),
  entryFee: z.number().nonnegative().default(0),
  day: z.string().optional(),
  checkinEnd: z.string().optional(),
  startTime: z.string().optional(),
  poolQualifiers: z.number().int().min(1).max(4).default(2),
  byePlayers: z.string().default(''),
  dotationQuarter: z.number().nonnegative().default(0),
  dotationSemi: z.number().nonnegative().default(0),
  dotationFinalist: z.number().nonnegative().default(0),
  dotationWinner: z.number().nonnegative().default(0),
  prize: z.string().default(''),
});

export async function POST(req: NextRequest) {
  try {
    await requireRole(['admin']);
    const body = CreateSchema.parse(await req.json());
    const created = await prisma.bracket.create({
      data: {
        ...body,
        entryFee: new Prisma.Decimal(body.entryFee),
        dotationQuarter: new Prisma.Decimal(body.dotationQuarter),
        dotationSemi: new Prisma.Decimal(body.dotationSemi),
        dotationFinalist: new Prisma.Decimal(body.dotationFinalist),
        dotationWinner: new Prisma.Decimal(body.dotationWinner),
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
