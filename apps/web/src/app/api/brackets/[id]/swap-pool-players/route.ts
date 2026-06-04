/**
 * POST /api/brackets/:id/swap-pool-players
 *
 * Échange deux joueurs entre deux poules différentes.
 * Body : { playerAId: string, playerBId: string }
 * Ne fonctionne que si les matchs de poule sont encore en 'waiting'.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';

interface Params { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin']);
    const { id: bracketId } = await params;
    const body = await req.json();
    const { playerAId, playerBId } = body;

    if (!playerAId || !playerBId || playerAId === playerBId) {
      return NextResponse.json(
        { error: 'playerAId et playerBId requis et distincts' },
        { status: 400 },
      );
    }

    // Récupère tous les matchs de poule pour ce bracket
    const poolMatches = await prisma.match.findMany({
      where: { bracketId, poolNumber: { not: null } },
      select: { id: true, player1Id: true, player2Id: true, poolNumber: true, status: true },
    });

    // Vérifie qu'aucun match n'est commencé
    const started = poolMatches.find(
      (m) =>
        (m.player1Id === playerAId || m.player2Id === playerAId ||
         m.player1Id === playerBId || m.player2Id === playerBId) &&
        m.status !== 'waiting',
    );
    if (started) {
      return NextResponse.json(
        { error: 'Impossible de modifier : des matchs de ces joueurs ont déjà commencé.' },
        { status: 409 },
      );
    }

    // Détermine les poules des deux joueurs
    const poolA = poolMatches.find(
      (m) => m.player1Id === playerAId || m.player2Id === playerAId,
    )?.poolNumber;
    const poolB = poolMatches.find(
      (m) => m.player1Id === playerBId || m.player2Id === playerBId,
    )?.poolNumber;

    if (poolA == null || poolB == null) {
      return NextResponse.json(
        { error: 'Joueur(s) non trouvé(s) dans les poules de ce tableau.' },
        { status: 404 },
      );
    }

    if (poolA === poolB) {
      return NextResponse.json(
        { error: 'Les deux joueurs sont déjà dans la même poule.' },
        { status: 400 },
      );
    }

    // Effectue le swap dans une transaction
    await prisma.$transaction(async (tx) => {
      // Matchs de A dans la poule A
      const matchesA = poolMatches.filter(
        (m) =>
          m.poolNumber === poolA &&
          (m.player1Id === playerAId || m.player2Id === playerAId),
      );
      // Matchs de B dans la poule B
      const matchesB = poolMatches.filter(
        (m) =>
          m.poolNumber === poolB &&
          (m.player1Id === playerBId || m.player2Id === playerBId),
      );

      // Remplace A par B dans les matchs de la poule A
      for (const m of matchesA) {
        const data: Record<string, string | null> = {};
        if (m.player1Id === playerAId) data.player1Id = playerBId;
        if (m.player2Id === playerAId) data.player2Id = playerBId;
        await tx.match.update({ where: { id: m.id }, data });
      }

      // Remplace B par A dans les matchs de la poule B
      for (const m of matchesB) {
        const data: Record<string, string | null> = {};
        if (m.player1Id === playerBId) data.player1Id = playerAId;
        if (m.player2Id === playerBId) data.player2Id = playerAId;
        await tx.match.update({ where: { id: m.id }, data });
      }
    });

    return NextResponse.json({ ok: true, swapped: { playerAId, playerBId, poolA, poolB } });
  } catch (e) {
    return errorResponse(e);
  }
}
