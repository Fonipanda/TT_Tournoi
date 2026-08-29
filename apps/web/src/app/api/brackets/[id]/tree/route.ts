/**
 * GET /api/brackets/:id/tree — données pour l'affichage du tableau final (L11).
 *
 * Route publique : la projection est restreinte aux seuls champs affichés par
 * l'arbre. Un `include` complet exposerait email, téléphone et numéro de licence
 * de chaque joueur à qui connaît l'identifiant du tableau.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@tt/db';

interface Params { params: Promise<{ id: string }> }

const playerSelect = {
  id: true,
  firstName: true,
  lastName: true,
  club: true,
} as const;

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const matches = await prisma.match.findMany({
    where: { bracketId: id, poolNumber: null },
    select: {
      id: true,
      roundNumber: true,
      roundName: true,
      poolMatchOrder: true,
      status: true,
      setsP1: true,
      setsP2: true,
      sets: true,
      player1: { select: playerSelect },
      player2: { select: playerSelect },
      winner: { select: playerSelect },
    },
    orderBy: [{ roundNumber: 'asc' }, { createdAt: 'asc' }],
  });
  return NextResponse.json({ data: matches });
}
