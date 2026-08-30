/**
 * POST /api/matches/:id/finish
 *
 * Termine un match : winner + scores finaux + barème FFTT de gain et de perte
 * de points + libération de la table + publish event 'match_completed'.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma, Prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';
import { publishLiveEvent } from '@/lib/live/publisher';
import { ffttMatchPoints } from '@/lib/fftt/points';
import { getPointsCoefficient } from '@/lib/fftt/points-setting';
import { notifySms } from '@/lib/sms/notify';

interface Params { params: Promise<{ id: string }> }

const FinishSchema = z.object({
  winnerId: z.string().uuid(),
  scoreP1: z.number().int().min(0),
  scoreP2: z.number().int().min(0),
  setsP1: z.number().int().min(0),
  setsP2: z.number().int().min(0),
  sets: z.array(z.object({ p1: z.number(), p2: z.number() })).optional(),
  version: z.number().int().min(0),
  optimisticId: z.string().optional(),
  isForfeit: z.boolean().optional(),
  forfeitPlayerId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(['admin', 'juge_arbitre']);
    const { id } = await params;
    const body = FinishSchema.parse(await req.json());

    // Coefficient de l'épreuve, lu hors transaction : c'est un réglage global
    // et sa lecture n'a pas à prolonger le verrou pris sur le match.
    const coefficient = await getPointsCoefficient();

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.match.findUnique({
        where: { id },
        include: { player1: true, player2: true },
      });
      if (!current) throw new Error('Match introuvable');

      let m;
      try {
        m = await tx.match.update({
          where: { id, version: body.version },
          data: {
            status: 'finished',
            winnerId: body.winnerId,
            scoreP1: body.scoreP1,
            scoreP2: body.scoreP2,
            setsP1: body.setsP1,
            setsP2: body.setsP2,
            sets: (body.sets ?? []) as Prisma.InputJsonValue,
            isForfeit: body.isForfeit ?? false,
            forfeitPlayerId: body.forfeitPlayerId,
            endTime: new Date(),
            version: { increment: 1 },
          },
          include: { player1: true, player2: true, table: true, winner: true },
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
          throw new VersionConflictError(current.version);
        }
        throw e;
      }

      // Barème FFTT de gain et de perte de points (si pas forfait).
      //
      // Contrairement à l'ancien « swap », le barème fédéral n'est pas à somme
      // nulle : une performance rapporte au vainqueur bien plus que le contre
      // ne coûte au battu. Les deux deltas sont donc calculés séparément.
      if (!body.isForfeit && current.player1Id && current.player2Id) {
        const winnerIsP1 = body.winnerId === current.player1Id;
        const winner = winnerIsP1 ? current.player1 : current.player2;
        const loser = winnerIsP1 ? current.player2 : current.player1;
        if (winner && loser) {
          // Le règlement retient les points « en début d'épreuve ». On lit
          // donc le classement figé à l'inscription sur ce tableau, et non la
          // fiche joueur, qui a déjà bougé si le joueur a joué avant.
          const regs = await tx.playerBracketRegistration.findMany({
            where: {
              bracketId: current.bracketId,
              playerId: { in: [winner.id, loser.id] },
            },
            select: { playerId: true, pointsAtRegistration: true },
          });
          const basePoints = (p: { id: string; points: number }): number =>
            regs.find((r) => r.playerId === p.id)?.pointsAtRegistration ?? p.points;

          const winnerBase = basePoints(winner);
          const loserBase = basePoints(loser);

          const winnerDelta = ffttMatchPoints({
            playerPoints: winnerBase,
            opponentPoints: loserBase,
            victory: true,
            coefficient,
          }).points;
          const loserDelta = ffttMatchPoints({
            playerPoints: loserBase,
            opponentPoints: winnerBase,
            victory: false,
            coefficient,
          }).points;

          if (winnerDelta !== 0) {
            await tx.player.update({
              where: { id: winner.id },
              data: { points: { increment: winnerDelta } },
            });
          }
          if (loserDelta !== 0) {
            await tx.player.update({
              where: { id: loser.id },
              data: { points: { increment: loserDelta } },
            });
          }
        }
      }

      // Libérer la table :
      // - Poule : libérer seulement quand TOUS les matchs de la poule sont terminés
      // - Élimination : libérer immédiatement
      if (m.tableId) {
        const isPoolMatch = current.poolNumber != null;
        let shouldRelease = true;

        if (isPoolMatch) {
          // Vérifier si tous les matchs de la même poule sont terminés
          const pendingPoolMatches = await tx.match.count({
            where: {
              bracketId: current.bracketId,
              poolNumber: current.poolNumber,
              status: { not: 'finished' },
              id: { not: id },
            },
          });
          shouldRelease = pendingPoolMatches === 0;
        }

        if (shouldRelease) {
          await tx.tableModel.update({
            where: { id: m.tableId },
            data: { status: 'free', currentMatchId: null },
          });
        } else {
          // Poule pas terminée: on garde la table rouge mais on enlève le match courant
          await tx.tableModel.update({
            where: { id: m.tableId },
            data: { currentMatchId: null },
          });
        }
      }

      // Auto-avance : si match d'élimination, propager le vainqueur au tour suivant.
      // Convention de positions (poolMatchOrder utilisé comme position dans le round) :
      //   round N+1 match k = vainqueur(round N match 2k-1) vs vainqueur(round N match 2k)
      // → nextPos = ceil(myPos/2) ; slot = (myPos-1) % 2 (0 → player1, 1 → player2)
      const isElimMatch = current.poolNumber === null && current.poolMatchOrder !== null;
      if (isElimMatch && body.winnerId) {
        const myPos = current.poolMatchOrder!;
        const nextRound = current.roundNumber + 1;
        const nextPos = Math.ceil(myPos / 2);
        const slotIsPlayer1 = ((myPos - 1) % 2) === 0;
        const nextMatch = await tx.match.findFirst({
          where: {
            bracketId: current.bracketId,
            roundNumber: nextRound,
            poolMatchOrder: nextPos,
          },
        });
        if (nextMatch) {
          await tx.match.update({
            where: { id: nextMatch.id },
            data: slotIsPlayer1
              ? { player1Id: body.winnerId }
              : { player2Id: body.winnerId },
          });
        }
      }

      // Idempotency
      if (body.optimisticId) {
        await tx.matchEvent.upsert({
          where: { matchId_clientId: { matchId: id, clientId: body.optimisticId } },
          update: {},
          create: {
            matchId: id,
            type: 'finish',
            payload: body as unknown as Prisma.InputJsonValue,
            actorId: user.userId,
            clientId: body.optimisticId,
          },
        });
      }

      return m;
    });

    await publishLiveEvent({
      type: 'match_completed',
      match: {
        id: result.id,
        bracketId: result.bracketId,
        player1: result.player1,
        player2: result.player2,
        tableId: result.tableId,
        tableNumber: result.table?.number ?? null,
        status: result.status,
        scoreP1: result.scoreP1,
        scoreP2: result.scoreP2,
        setsP1: result.setsP1,
        setsP2: result.setsP2,
        version: result.version,
      },
      winner: result.winner
        ? { id: result.winner.id, firstName: result.winner.firstName, lastName: result.winner.lastName }
        : null,
    });

    // Résultat enregistré : SMS aux deux joueurs (déclencheur désactivé par défaut).
    const bracket = await prisma.bracket.findUnique({
      where: { id: result.bracketId },
      select: { name: true },
    });
    const label = (p: { lastName: string; firstName: string } | null) =>
      p ? `${p.lastName} ${p.firstName}` : '';
    await notifySms('result', [result.player1Id, result.player2Id], (playerId) => ({
      joueur: label(playerId === result.player1Id ? result.player1 : result.player2),
      adversaire: label(playerId === result.player1Id ? result.player2 : result.player1),
      tableau: bracket?.name ?? '',
      table: result.table?.number ?? '',
    }));

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof VersionConflictError) {
      return NextResponse.json(
        { error: 'version_conflict', currentVersion: e.currentVersion },
        { status: 409 },
      );
    }
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}

class VersionConflictError extends Error {
  constructor(public readonly currentVersion: number) {
    super('Version conflict');
  }
}
