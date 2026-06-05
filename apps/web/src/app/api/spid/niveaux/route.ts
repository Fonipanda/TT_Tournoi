/**
 * GET /api/spid/niveaux
 *
 * Renvoie les statistiques de saisie par tableau du tournoi actif :
 * pour chaque bracket, le nombre de matches finis, en cours, en attente, total.
 * Utilisé dans l'onglet SPID du Juge-Arbitre pour suivre l'avancement.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@tt/db';
import { requireRole, errorResponse } from '@/lib/auth/server';

export async function GET() {
  try {
    await requireRole(['admin', 'juge_arbitre']);

    const tournament = await prisma.tournament.findFirst({
      where: { isActive: true },
      include: {
        brackets: {
          include: {
            _count: {
              select: { registrations: { where: { isActive: true } } },
            },
            matches: {
              select: { status: true, poolNumber: true, roundNumber: true },
            },
          },
          orderBy: { name: 'asc' },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ data: [] });
    }

    const data = tournament.brackets.map((b) => {
      const finished = b.matches.filter((m) => m.status === 'finished').length;
      const inProgress = b.matches.filter((m) => m.status === 'in_progress').length;
      const waiting = b.matches.filter((m) => m.status === 'waiting').length;
      const blocked = b.matches.filter((m) => m.status === 'blocked').length;
      const total = b.matches.length;
      const poolMatches = b.matches.filter((m) => m.poolNumber !== null).length;
      const elimMatches = total - poolMatches;
      return {
        id: b.id,
        name: b.name,
        category: b.category,
        registered: b._count.registrations,
        total,
        finished,
        inProgress,
        waiting,
        blocked,
        poolMatches,
        elimMatches,
        progress: total > 0 ? Math.round((finished / total) * 100) : 0,
      };
    });

    return NextResponse.json({ data });
  } catch (e) {
    return errorResponse(e);
  }
}
