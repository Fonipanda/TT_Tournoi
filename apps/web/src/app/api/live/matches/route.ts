/**
 * GET /api/live/matches — snapshot des matches en cours / en attente.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@tt/db';

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status');
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  else where.status = { in: ['waiting', 'in_progress'] };

  const matches = await prisma.match.findMany({
    where,
    include: {
      player1: true,
      player2: true,
      table: { select: { id: true, number: true, roomId: true } },
      bracket: { select: { id: true, name: true, category: true } },
    },
    orderBy: [{ status: 'asc' }, { startTime: 'asc' }, { createdAt: 'asc' }],
    take: 200,
  });
  return NextResponse.json({ data: matches, serverTime: new Date().toISOString() });
}
