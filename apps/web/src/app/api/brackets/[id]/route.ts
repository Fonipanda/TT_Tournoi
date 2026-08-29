/**
 * GET    /api/brackets/:id
 * PATCH  /api/brackets/:id
 * DELETE /api/brackets/:id
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma, prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';
import { formatDotation } from '@/lib/dotation';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const b = await prisma.bracket.findUnique({
    where: { id },
    include: {
      registrations: { include: { player: true } },
      matches: true,
      tournament: true,
    },
  });
  if (!b) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  return NextResponse.json(b);
}

const UpdateSchema = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
  minPoints: z.number().int().nullable().optional(),
  maxPoints: z.number().int().nullable().optional(),
  maxPlayers: z.number().int().optional(),
  entryFee: z.number().optional(),
  day: z.string().optional(),
  checkinEnd: z.string().optional(),
  startTime: z.string().optional(),
  poolQualifiers: z.number().int().optional(),
  byePlayers: z.string().optional(),
  dotationQuarter: z.number().optional(),
  dotationSemi: z.number().optional(),
  dotationFinalist: z.number().optional(),
  dotationWinner: z.number().optional(),
  // `prize` est accepté par compatibilité mais ignoré : le récap est une
  // projection des quatre montants, pas une saisie indépendante.
  prize: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin']);
    const { id } = await params;
    const body = UpdateSchema.parse(await req.json());
    const data: Record<string, unknown> = { ...body };
    for (const key of ['entryFee', 'dotationQuarter', 'dotationSemi', 'dotationFinalist', 'dotationWinner'] as const) {
      if (typeof body[key] === 'number') data[key] = new Prisma.Decimal(body[key] as number);
    }

    // Le récap est toujours recalculé, jamais repris du corps de la requête.
    // Un PATCH partiel peut ne porter qu'un seul montant : les autres sont
    // relus en base, sans quoi le récap serait reconstruit avec des zéros.
    const current = await prisma.bracket.findUnique({
      where: { id },
      select: {
        dotationWinner: true,
        dotationFinalist: true,
        dotationSemi: true,
        dotationQuarter: true,
      },
    });
    if (!current) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    data.prize = formatDotation({
      winner: body.dotationWinner ?? Number(current.dotationWinner),
      finalist: body.dotationFinalist ?? Number(current.dotationFinalist),
      semi: body.dotationSemi ?? Number(current.dotationSemi),
      quarter: body.dotationQuarter ?? Number(current.dotationQuarter),
    });

    const updated = await prisma.bracket.update({ where: { id }, data });
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
    await prisma.bracket.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
