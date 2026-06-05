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
      // Nombre de poules = nb de poolNumber distincts (et non nb de matchs de poule)
      const poolNumbers = new Set<number>();
      let poolMatchCount = 0;
      for (const m of b.matches) {
        if (m.poolNumber !== null) {
          poolNumbers.add(m.poolNumber);
          poolMatchCount++;
        }
      }
      const pools = poolNumbers.size;
      const elimMatches = total - poolMatchCount;
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
        pools,
        poolMatches: poolMatchCount,
        elimMatches,
        progress: total > 0 ? Math.round((finished / total) * 100) : 0,
      };
    });

    return NextResponse.json({ data });
  } catch (e) {
    return errorResponse(e);
  }
}
