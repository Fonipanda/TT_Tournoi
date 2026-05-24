/**
 * GET /api/live/tables — snapshot fallback (clients sans WS).
 */
import { NextResponse } from 'next/server';
import { prisma } from '@tt/db';

export async function GET() {
  const tables = await prisma.tableModel.findMany({
    orderBy: { number: 'asc' },
    include: {
      room: { select: { id: true, name: true } },
      currentMatch: {
        include: { player1: true, player2: true, bracket: { select: { name: true } } },
      },
    },
  });
  return NextResponse.json({ data: tables, serverTime: new Date().toISOString() });
}
