/**
 * PATCH /api/matches/:id/score
 *
 * Met à jour le score d'un match avec optimistic concurrency :
 * le client fournit la `version` qu'il connaît, le serveur vérifie qu'elle
 * correspond à l'état actuel — sinon 409 Conflict (PWA outbox doit resoumettre).
 *
 * Idempotency : si le client renvoie le même `optimisticId`, l'événement
 * MatchEvent ne sera pas dupliqué (contrainte UNIQUE).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma, Prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';
import { publishLiveEvent } from '@/lib/live/publisher';
import type { MatchConflictResponse } from '@tt/types';

interface Params { params: Promise<{ id: string }> }

const ScoreSchema = z.object({
  scoreP1: z.number().int().min(0),
  scoreP2: z.number().int().min(0),
  setsP1: z.number().int().min(0),
  setsP2: z.number().int().min(0),
  sets: z.array(z.object({ p1: z.number(), p2: z.number() })).optional(),
  version: z.number().int().min(0),
  optimisticId: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireRole(['admin', 'juge_arbitre']);
    const { id } = await params;
    const body = ScoreSchema.parse(await req.json());

    let updated;
    try {
      updated = await prisma.$transaction(async (tx) => {
        // Read current match to conditionally set startTime
        const current = await tx.match.findUnique({ where: { id } });
        if (!current) throw new Error('Match introuvable');

        const m = await tx.match.update({
          where: { id, version: body.version },
          data: {
            scoreP1: body.scoreP1,
            scoreP2: body.scoreP2,
            setsP1: body.setsP1,
            setsP2: body.setsP2,
            sets: (body.sets ?? []) as Prisma.InputJsonValue,
            status: 'in_progress',
            ...(current.startTime ? {} : { startTime: new Date() }),
            version: { increment: 1 },
          },
          include: { player1: true, player2: true, table: true },
        });

        // Idempotency : si optimisticId fourni, on insère un MatchEvent unique
        if (body.optimisticId) {
          await tx.matchEvent.upsert({
            where: { matchId_clientId: { matchId: id, clientId: body.optimisticId } },
            update: {},
            create: {
              matchId: id,
              type: 'score_update',
              payload: body as unknown as Prisma.InputJsonValue,
              actorId: user.userId,
              clientId: body.optimisticId,
            },
          });
        }
        return m;
      });
    } catch (e) {
      // Si update échoue à cause du `version` mismatch, Prisma renvoie une P2025
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025') {
        const current = await prisma.match.findUnique({ where: { id } });
        const conflict: MatchConflictResponse = {
          error: 'version_conflict',
          currentVersion: current?.version ?? 0,
          serverState: current,
        };
        return NextResponse.json(conflict, { status: 409 });
      }
      throw e;
    }

    await publishLiveEvent({
      type: 'match_score_updated',
      match: {
        id: updated.id,
        bracketId: updated.bracketId,
        player1: updated.player1,
        player2: updated.player2,
        tableId: updated.tableId,
        tableNumber: updated.table?.number ?? null,
        status: updated.status,
        scoreP1: updated.scoreP1,
        scoreP2: updated.scoreP2,
        setsP1: updated.setsP1,
        setsP2: updated.setsP2,
        version: updated.version,
      },
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}
