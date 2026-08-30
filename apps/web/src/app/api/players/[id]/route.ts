/**
 * GET    /api/players/:id
 * PATCH  /api/players/:id        (admin ou player lui-même)
 * DELETE /api/players/:id        (admin)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { errorResponse, getCurrentUser, HttpError, requireRole } from '@/lib/auth/server';
import { optionalPhoneField } from '@/lib/validation/phone';
import {
  dailyQuotaMessage,
  findDailyQuotaViolation,
  findPointsWindowViolation,
} from '@/lib/registrations';

/**
 * Champs qui portent le classement officiel du joueur.
 *
 * Ils commandent l'accès aux tableaux : un joueur qui pourrait éditer ses
 * propres points contournerait d'un appel le plafond vérifié à l'inscription.
 * Seule l'organisation les modifie ; côté joueur, la mise à jour passe par la
 * synchronisation FFTT (`POST /api/players/:id/sync-fftt`).
 */
const RANKING_FIELDS = ['points', 'ranking', 'licenseNumber'] as const;

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const p = await prisma.player.findUnique({
    where: { id },
    include: {
      registrations: { include: { bracket: true } },
    },
  });
  if (!p) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
  return NextResponse.json(p);
}

const UpdateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  licenseNumber: z.string().optional(),
  ranking: z.string().optional(),
  points: z.number().optional(),
  club: z.string().optional(),
  email: z.string().email().or(z.literal('')).optional(),
  phone: optionalPhoneField,
  isActive: z.boolean().optional(),
  bracketIds: z.array(z.string()).optional(),
});

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const me = await getCurrentUser();
    if (!me) throw new HttpError(401, 'Auth requise');
    if (me.role !== 'admin' && me.playerId !== id) {
      throw new HttpError(403, 'Modification interdite');
    }
    const body = UpdateSchema.parse(await req.json());
    const { bracketIds, ...playerData } = body;

    // Rejet explicite plutôt que filtrage silencieux : un client qui croit
    // avoir mis à jour un classement doit savoir qu'il n'en a rien été.
    if (me.role !== 'admin') {
      const attempted = RANKING_FIELDS.filter((f) => playerData[f] !== undefined);
      if (attempted.length > 0) {
        throw new HttpError(
          403,
          `Champs réservés à l'organisation : ${attempted.join(', ')}. Utilise la synchronisation FFTT pour actualiser ton classement.`,
        );
      }
    }

    // Le quota FFTT s'applique aussi aux inscriptions posées par l'admin.
    // Contrôlé AVANT toute écriture, sinon la fiche joueur serait modifiée
    // puis la synchronisation des tableaux rejetée : état incohérent.
    const syncBrackets = bracketIds !== undefined && me.role === 'admin';
    if (syncBrackets) {
      const uniqueIds = [...new Set(bracketIds)];
      const rows = await prisma.bracket.findMany({
        where: { id: { in: uniqueIds } },
        select: {
          id: true,
          name: true,
          tournamentId: true,
          day: true,
          minPoints: true,
          maxPoints: true,
          maxPlayers: true,
          // Seules les inscriptions actives occupent une place.
          _count: { select: { registrations: { where: { isActive: true } } } },
        },
      });
      if (rows.length !== uniqueIds.length) {
        throw new HttpError(400, 'Tableau inconnu');
      }
      const targetBrackets = rows.map((b) => ({
        id: b.id,
        name: b.name,
        tournamentId: b.tournamentId,
        day: b.day,
        minPoints: b.minPoints,
        maxPoints: b.maxPoints,
        maxPlayers: b.maxPlayers,
        registeredCount: b._count.registrations,
      }));
      // `bracketIds` décrit l'état final complet : on part d'une base vide.
      const violation = findDailyQuotaViolation([], targetBrackets);
      if (violation) throw new HttpError(400, dailyQuotaMessage(violation));

      // Ce chemin est réservé à l'admin : la fenêtre de points ne bloque donc
      // pas, mais tout franchissement est tracé. Le classement évalué est celui
      // envoyé dans la même requête s'il y en a un, sinon celui en base —
      // sans quoi corriger des points et des tableaux d'un seul coup
      // journaliserait une dérogation fantôme.
      const current = await prisma.player.findUnique({
        where: { id },
        select: { points: true, ffttSyncedAt: true, firstName: true, lastName: true },
      });
      if (!current) throw new HttpError(404, 'Joueur introuvable');
      const window = findPointsWindowViolation(targetBrackets, {
        points: playerData.points ?? current.points,
        ffttSyncedAt: current.ffttSyncedAt,
      });
      if (window) {
        console.warn(
          `[inscriptions] dérogation admin — ${current.lastName} ${current.firstName} (${window.points} pts, motif ${window.reason}) inscrit sur « ${window.bracket.name} » [${window.bracket.minPoints ?? '−'} ; ${window.bracket.maxPoints ?? '−'}]`,
        );
      }
    }

    // Update player fields
    const updated = await prisma.player.update({ where: { id }, data: playerData });

    // If bracketIds provided, sync registrations (admin only)
    if (syncBrackets && bracketIds) {
      // Get current active registrations
      const existing = await prisma.playerBracketRegistration.findMany({
        where: { playerId: id, isActive: true },
        select: { id: true, bracketId: true },
      });
      const existingBracketIds = existing.map((r: { id: string; bracketId: string }) => r.bracketId);

      // Add new registrations
      const toAdd = bracketIds.filter((bid) => !existingBracketIds.includes(bid));
      for (const bracketId of toAdd) {
        await prisma.playerBracketRegistration.create({
          data: {
            playerId: id,
            bracketId,
            paymentStatus: 'pending',
            isActive: true,
            qrToken: `${id}-${bracketId}-${Date.now().toString(36)}`,
            // Classement figé pour le barème FFTT, pris après la mise à jour
            // de la fiche : l'admin peut corriger les points et poser les
            // inscriptions dans la même requête, c'est la valeur corrigée qui
            // fait foi pour l'épreuve.
            pointsAtRegistration: updated.points,
          },
        });
      }

      // Deactivate removed registrations
      const toRemove = existing.filter((r: { id: string; bracketId: string }) => !bracketIds.includes(r.bracketId));
      for (const reg of toRemove) {
        await prisma.playerBracketRegistration.update({
          where: { id: reg.id },
          data: { isActive: false },
        });
      }
    }

    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin']);
    const { id } = await params;
    const hard = req.nextUrl.searchParams.get('hard') === 'true';
    if (hard) {
      // Suppression physique : cascade sur registrations, notifications, matchs
      await prisma.player.delete({ where: { id } });
    } else {
      await prisma.player.update({ where: { id }, data: { isActive: false } });
    }
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    return errorResponse(e);
  }
}
