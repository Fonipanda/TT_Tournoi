/**
 * POST /api/matches/:id/finish
 *
 * Termine un match : winner + scores finaux + FFTT points-swap +
 * libération de la table + publish event 'match_completed'.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma, Prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';
import { publishLiveEvent } from '@/lib/live/publisher';
import { fftPointsSwap } from '@/lib/fftt/engine';

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

      // FFTT points-swap (si pas forfait)
      if (!body.isForfeit && current.player1Id && current.player2Id) {
        const winnerIsP1 = body.winnerId === current.player1Id;
        const winner = winnerIsP1 ? current.player1 : current.player2;
        const loser = winnerIsP1 ? current.player2 : current.player1;
        if (winner && loser) {
          const swap = fftPointsSwap(winner.points, loser.points);
          await tx.player.update({ where: { id: winner.id }, data: { points: { increment: swap } } });
          await tx.player.update({ where: { id: loser.id }, data: { points: { decrement: swap } } });
        }
      }

      // Libérer la table
      if (m.tableId) {
        await tx.tableModel.update({
          where: { id: m.tableId },
          data: { status: 'free', currentMatchId: null },
        });
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
