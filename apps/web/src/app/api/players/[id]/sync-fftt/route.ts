/**
 * POST /api/players/:id/sync-fftt — Synchronise les points du joueur depuis FFTT.
 * Accessible par le joueur lui-même ou un admin.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@tt/db';
import { errorResponse, getCurrentUser, HttpError } from '@/lib/auth/server';
import { lookupFfttPlayer, FfttError } from '@/lib/fftt/client';
import { redis } from '@/lib/redis';

interface Params { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const me = await getCurrentUser();
    if (!me) throw new HttpError(401, 'Auth requise');

    const { id } = await params;
    if (me.role !== 'admin' && me.playerId !== id) {
      throw new HttpError(403, 'Accès refusé');
    }

    const player = await prisma.player.findUnique({ where: { id } });
    if (!player || !player.licenseNumber) {
      throw new HttpError(400, 'Joueur sans licence FFTT');
    }

    // Vider le cache pour forcer une re-récupération
    await redis.del(`fftt:player:${player.licenseNumber}`).catch(() => undefined);

    let fftt;
    try {
      fftt = await lookupFfttPlayer(player.licenseNumber);
    } catch (e) {
      if (e instanceof FfttError) {
        throw new HttpError(e.status, `FFTT: ${e.message}`);
      }
      throw e;
    }

    const updated = await prisma.player.update({
      where: { id },
      data: {
        points: fftt.points,
        firstName: fftt.prenom,
        lastName: fftt.nom,
        club: fftt.club ?? player.club,
        // Atteste que le classement provient de la fédération : c'est ce
        // marqueur qui ouvre les tableaux à borne de points.
        ffttSyncedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      player: {
        id: updated.id,
        firstName: updated.firstName,
        lastName: updated.lastName,
        club: updated.club,
        points: updated.points,
        ffttSyncedAt: updated.ffttSyncedAt,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
