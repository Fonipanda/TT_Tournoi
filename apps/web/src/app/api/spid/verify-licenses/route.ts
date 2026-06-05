/**
 * POST /api/spid/verify-licenses
 *
 * Re-synchronise tous les joueurs inscrits au tournoi actif depuis FFTT.
 * Pour chaque joueur avec licence, met à jour Nom/Prénom/Club/Points.
 * Renvoie un rapport : {ok, updated, errors[]}.
 *
 * Inspiré de la fonction "Vérifications des licences" d'OTC Inscriptions.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@tt/db';
import { requireRole, errorResponse } from '@/lib/auth/server';
import { lookupFfttPlayer, FfttError } from '@/lib/fftt/client';
import { redis } from '@/lib/redis';

interface ErrorEntry {
  licenseNumber: string;
  name: string;
  message: string;
}

export async function POST() {
  try {
    await requireRole(['admin', 'juge_arbitre']);

    const tournament = await prisma.tournament.findFirst({ where: { isActive: true } });
    if (!tournament) {
      return NextResponse.json({ ok: false, error: 'Aucun tournoi actif' }, { status: 404 });
    }

    // Tous les joueurs inscrits dans au moins un bracket de ce tournoi
    const players = await prisma.player.findMany({
      where: {
        licenseNumber: { not: null },
        registrations: {
          some: {
            isActive: true,
            bracket: { tournamentId: tournament.id },
          },
        },
      },
      orderBy: { lastName: 'asc' },
    });

    let updated = 0;
    let unchanged = 0;
    const errors: ErrorEntry[] = [];

    for (const p of players) {
      if (!p.licenseNumber) continue;
      try {
        // Force fresh lookup (clear cache)
        await redis.del(`fftt:player:${p.licenseNumber}`).catch(() => undefined);
        const fftt = await lookupFfttPlayer(p.licenseNumber);

        const changes: Record<string, unknown> = {};
        if (fftt.points !== p.points) changes.points = fftt.points;
        if (fftt.nom !== p.lastName) changes.lastName = fftt.nom;
        if (fftt.prenom !== p.firstName) changes.firstName = fftt.prenom;
        if (fftt.club && fftt.club !== p.club) changes.club = fftt.club;

        if (Object.keys(changes).length > 0) {
          await prisma.player.update({ where: { id: p.id }, data: changes });
          updated++;
        } else {
          unchanged++;
        }
      } catch (e) {
        errors.push({
          licenseNumber: p.licenseNumber,
          name: `${p.lastName} ${p.firstName}`,
          message: e instanceof FfttError ? e.message : 'Erreur de récupération',
        });
      }
    }

    return NextResponse.json({
      ok: true,
      checked: players.length,
      updated,
      unchanged,
      errors,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
