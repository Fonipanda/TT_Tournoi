/**
 * GET  /api/menu?tournamentId=...  — retourne sections + items (public)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@tt/db';

export async function GET(req: NextRequest) {
  const tournamentId = req.nextUrl.searchParams.get('tournamentId');
  if (!tournamentId) {
    // fallback : premier tournoi actif
    const t = await prisma.tournament.findFirst({
      where: { isActive: true },
      orderBy: { startDate: 'desc' },
    });
    if (!t) return NextResponse.json({ data: [] });
    return loadMenu(t.id);
  }
  return loadMenu(tournamentId);
}

async function loadMenu(tournamentId: string) {
  const sections = await prisma.menuSection.findMany({
    where: { tournamentId },
    orderBy: { order: 'asc' },
    include: {
      items: {
        where: { isAvailable: true },
        orderBy: { order: 'asc' },
      },
    },
  });
  return NextResponse.json({ data: sections });
}
