/**
 * GET /api/brackets/:id/tree — données pour BracketTree (L11)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@tt/db';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const matches = await prisma.match.findMany({
    where: { bracketId: id, poolNumber: null },
    include: { player1: true, player2: true, winner: true },
    orderBy: [{ roundNumber: 'asc' }, { createdAt: 'asc' }],
  });
  return NextResponse.json({ data: matches });
}
