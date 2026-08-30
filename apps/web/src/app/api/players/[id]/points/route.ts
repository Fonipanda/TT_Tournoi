/**
 * GET /api/players/:id/points — Détail du calcul de points d'un joueur.
 *
 * Reconstitue, partie par partie, le gain et la perte de points au barème
 * FFTT sur l'ensemble des matchs terminés du joueur, regroupés par tableau.
 *
 * La reconstruction est faite à la lecture plutôt que stockée : le
 * coefficient d'épreuve est un réglage modifiable, et un historique figé
 * cesserait de correspondre à la fiche du joueur dès sa première correction.
 *
 * Accessible par le joueur lui-même ou un admin.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@tt/db';
import { errorResponse, getCurrentUser, HttpError } from '@/lib/auth/server';
import { ffttMatchPoints, type MatchPointsExclusion, type MatchPointsKind } from '@/lib/fftt/points';
import { getPointsCoefficient } from '@/lib/fftt/points-setting';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

interface MatchLine {
  matchId: string;
  roundName: string | null;
  poolNumber: number | null;
  playedAt: string | null;
  opponentName: string | null;
  opponentClub: string | null;
  opponentPoints: number | null;
  playerPoints: number;
  victory: boolean;
  scoreLabel: string;
  gap: number;
  kind: MatchPointsKind;
  rawPoints: number;
  points: number;
  excluded: MatchPointsExclusion | null;
}

interface BracketGroup {
  bracketId: string;
  bracketName: string;
  tournamentName: string;
  basePoints: number;
  subtotal: number;
  matches: MatchLine[];
}

/** Arrondi au centième, pour éviter les traînées de flottants sur les totaux. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function fullName(p: { firstName: string; lastName: string } | null): string | null {
  return p ? `${p.firstName} ${p.lastName}`.trim() : null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const me = await getCurrentUser();
    if (!me) throw new HttpError(401, 'Auth requise');

    const { id } = await params;
    if (me.role !== 'admin' && me.playerId !== id) {
      throw new HttpError(403, 'Accès refusé');
    }

    const player = await prisma.player.findUnique({
      where: { id },
      select: { id: true, firstName: true, lastName: true, points: true },
    });
    if (!player) throw new HttpError(404, 'Joueur introuvable');

    const coefficient = await getPointsCoefficient();

    const matches = await prisma.match.findMany({
      where: {
        status: 'finished',
        OR: [{ player1Id: id }, { player2Id: id }],
      },
      select: {
        id: true,
        bracketId: true,
        player1Id: true,
        player2Id: true,
        winnerId: true,
        isForfeit: true,
        setsP1: true,
        setsP2: true,
        roundName: true,
        roundNumber: true,
        poolNumber: true,
        endTime: true,
        createdAt: true,
        bracket: {
          select: {
            id: true,
            name: true,
            tournament: { select: { name: true } },
          },
        },
        player1: { select: { id: true, firstName: true, lastName: true, club: true, points: true } },
        player2: { select: { id: true, firstName: true, lastName: true, club: true, points: true } },
      },
      orderBy: [{ bracketId: 'asc' }, { roundNumber: 'asc' }, { createdAt: 'asc' }],
    });

    // Snapshots de classement en début d'épreuve, pour le joueur ET ses
    // adversaires : le barème compare deux valeurs figées, en mélanger une
    // figée et une courante fausserait l'écart. La requête est bornée aux
    // seuls tableaux et joueurs concernés.
    const bracketIds = [...new Set(matches.map((m) => m.bracketId))];
    const playerIds = [
      ...new Set(
        matches.flatMap((m) => [m.player1Id, m.player2Id]).filter((p): p is string => p !== null),
      ),
    ];
    const registrations =
      bracketIds.length > 0
        ? await prisma.playerBracketRegistration.findMany({
            where: { bracketId: { in: bracketIds }, playerId: { in: playerIds } },
            select: { playerId: true, bracketId: true, pointsAtRegistration: true },
          })
        : [];

    // Index (joueur, tableau) → points d'inscription.
    const snapshots = new Map<string, number>();
    for (const r of registrations) {
      if (r.pointsAtRegistration !== null) {
        snapshots.set(`${r.playerId}:${r.bracketId}`, r.pointsAtRegistration);
      }
    }
    // Repli sur la fiche joueur pour les inscriptions antérieures au snapshot.
    const basePointsOf = (
      p: { id: string; points: number } | null,
      bracketId: string,
    ): number | null => {
      if (!p) return null;
      return snapshots.get(`${p.id}:${bracketId}`) ?? p.points;
    };

    const groups = new Map<string, BracketGroup>();
    /** Date de la première partie de chaque tableau, pour l'ordre d'affichage. */
    const firstPlayedAt = new Map<string, number>();
    let totalPoints = 0;
    let perfs = 0;
    let contres = 0;
    let victories = 0;
    let defeats = 0;
    let earliest: { at: number; basePoints: number } | null = null;

    for (const m of matches) {
      const isP1 = m.player1Id === id;
      const self = isP1 ? m.player1 : m.player2;
      const opponent = isP1 ? m.player2 : m.player1;

      const playerPoints = basePointsOf(self, m.bracketId) ?? player.points;
      const opponentPoints = basePointsOf(opponent, m.bracketId);
      // Un match terminé sans vainqueur désigné (donnée héritée) est traité
      // comme une défaite plutôt qu'ignoré : mieux vaut une ligne visible et
      // discutable qu'un trou silencieux dans le parcours.
      const victory = m.winnerId === id;

      const computed = ffttMatchPoints({
        playerPoints,
        opponentPoints,
        victory,
        coefficient,
        isForfeit: m.isForfeit,
      });

      const selfSets = isP1 ? m.setsP1 : m.setsP2;
      const oppSets = isP1 ? m.setsP2 : m.setsP1;
      const playedAt = m.endTime ?? m.createdAt;
      const playedAtMs = playedAt.getTime();

      if (!earliest || playedAtMs < earliest.at) {
        earliest = { at: playedAtMs, basePoints: playerPoints };
      }

      const key = m.bracketId;
      let group = groups.get(key);
      if (!group) {
        group = {
          bracketId: m.bracketId,
          bracketName: m.bracket.name,
          tournamentName: m.bracket.tournament.name,
          basePoints: playerPoints,
          subtotal: 0,
          matches: [],
        };
        groups.set(key, group);
      }
      const known = firstPlayedAt.get(key);
      if (known === undefined || playedAtMs < known) firstPlayedAt.set(key, playedAtMs);

      group.matches.push({
        matchId: m.id,
        roundName: m.roundName,
        poolNumber: m.poolNumber,
        playedAt: playedAt.toISOString(),
        opponentName: fullName(opponent),
        opponentClub: opponent?.club ?? null,
        opponentPoints,
        playerPoints,
        victory,
        scoreLabel: `${selfSets}-${oppSets}`,
        gap: computed.gap,
        kind: computed.kind,
        rawPoints: computed.rawPoints,
        points: computed.points,
        excluded: computed.excluded,
      });

      group.subtotal = round2(group.subtotal + computed.points);
      totalPoints = round2(totalPoints + computed.points);

      if (!computed.excluded) {
        if (victory) victories += 1;
        else defeats += 1;
        if (computed.kind === 'perf') perfs += 1;
        if (computed.kind === 'contre') contres += 1;
      }
    }

    // Du plus récent au plus ancien : le joueur consulte d'abord l'épreuve
    // qu'il vient de disputer.
    const groupList = [...groups.values()].sort(
      (a, b) => (firstPlayedAt.get(b.bracketId) ?? 0) - (firstPlayedAt.get(a.bracketId) ?? 0),
    );
    // Points de départ : le classement d'entrée au moment de la toute première
    // partie jouée. Sans aucun match, la fiche courante fait référence.
    const basePoints = earliest ? earliest.basePoints : player.points;

    return NextResponse.json({
      playerId: player.id,
      playerName: `${player.firstName} ${player.lastName}`.trim(),
      coefficient,
      basePoints,
      totalPoints,
      projectedPoints: round2(basePoints + totalPoints),
      currentPoints: player.points,
      victories,
      defeats,
      perfs,
      contres,
      groups: groupList,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
