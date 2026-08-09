/**
 * GET  /api/matches?bracketId=&status=&tableId=
 * POST /api/matches               (admin) — création manuelle, rare
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma, MatchStatus } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';
import { publishLiveEvent } from '@/lib/live/publisher';
import { notifySms } from '@/lib/sms/notify';

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const where: Record<string, unknown> = {};
  const bracketId = sp.get('bracketId');
  const status = sp.get('status');
  const tableId = sp.get('tableId');
  if (bracketId) where.bracketId = bracketId;
  if (status) where.status = status;
  if (tableId) where.tableId = tableId;

  const matches = await prisma.match.findMany({
    where,
    include: {
      player1: true,
      player2: true,
      table: true,
      bracket: { select: { id: true, name: true, category: true } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    take: 500,
  });
  return NextResponse.json({ data: matches });
}

const CreateSchema = z.object({
  bracketId: z.string().uuid(),
  player1Id: z.string().uuid().optional(),
  player2Id: z.string().uuid().optional(),
  roundName: z.string().optional(),
  roundNumber: z.number().int().default(1),
  poolNumber: z.number().int().optional(),
  poolMatchOrder: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  try {
    await requireRole(['admin']);
    const body = CreateSchema.parse(await req.json());
    const created = await prisma.match.create({ data: body });
    await publishLiveEvent({
      type: 'match_created',
      match: {
        id: created.id,
        bracketId: created.bracketId,
        player1: null,
        player2: null,
        tableId: null,
        tableNumber: null,
        status: created.status,
        scoreP1: 0,
        scoreP2: 0,
        setsP1: 0,
        setsP2: 0,
        version: created.version,
      },
    });

    // Convocation : uniquement sur création unitaire. La génération d'un
    // tableau complet (poules / élimination) ne notifie volontairement pas.
    const detail = await prisma.match.findUnique({
      where: { id: created.id },
      include: { bracket: { select: { name: true } }, player1: true, player2: true },
    });
    if (detail) {
      const label = (p: { lastName: string; firstName: string } | null) =>
        p ? `${p.lastName} ${p.firstName}` : '';
      await notifySms('match_created', [detail.player1Id, detail.player2Id], (playerId) => ({
        joueur: label(playerId === detail.player1Id ? detail.player1 : detail.player2),
        adversaire: label(playerId === detail.player1Id ? detail.player2 : detail.player1),
        tableau: detail.bracket?.name ?? '',
      }));
    }

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}
