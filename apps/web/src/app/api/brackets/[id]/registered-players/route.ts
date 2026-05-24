/**
 * GET /api/brackets/:id/registered-players
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@tt/db';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const regs = await prisma.playerBracketRegistration.findMany({
    where: { bracketId: id, isActive: true },
    include: { player: true },
    orderBy: { player: { lastName: 'asc' } },
  });
  return NextResponse.json({
    data: regs.map((r) => ({
      registrationId: r.id,
      player: r.player,
      paymentStatus: r.paymentStatus,
      checkinStatus: r.checkinStatus,
      dossardNumber: r.dossardNumber,
    })),
  });
}
