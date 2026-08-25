/**
 * POST /api/players/:id/registrations
 *  Body: { bracketIds: string[] }  — inscription multi-tableaux
 *
 * GET /api/players/:id/registrations
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import crypto from 'node:crypto';
import { prisma } from '@tt/db';
import { errorResponse, getCurrentUser, HttpError } from '@/lib/auth/server';
import {
  dailyQuotaMessage,
  findDailyQuotaViolation,
  findPointsWindowViolation,
  pointsWindowMessage,
} from '@/lib/registrations';

interface Params { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const regs = await prisma.playerBracketRegistration.findMany({
    where: { playerId: id, isActive: true },
    include: { bracket: { include: { tournament: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ data: regs });
}

const Schema = z.object({
  bracketIds: z.array(z.string().uuid()).min(1).max(8),
});

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const me = await getCurrentUser();
    if (!me) throw new HttpError(401, 'Auth requise');
    const { id } = await params;
    if (me.role !== 'admin' && me.playerId !== id) {
      throw new HttpError(403, 'Inscription pour autrui interdite');
    }
    const { bracketIds } = Schema.parse(await req.json());

    // Quota FFTT : 2 tableaux par jour et par joueur, tournoi par tournoi.
    // Contrôlé côté serveur — la règle appliquée dans le formulaire n'est
    // qu'une aide à la saisie.
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
        // Seules les inscriptions actives remplissent le tableau : une
        // inscription retirée par l'admin libère sa place, et la compter
        // maintiendrait artificiellement le tableau au-dessus du seuil.
        _count: { select: { registrations: { where: { isActive: true } } } },
      },
    });
    if (rows.length !== uniqueIds.length) {
      throw new HttpError(400, 'Tableau inconnu');
    }
    const requested = rows.map((b) => ({
      id: b.id,
      name: b.name,
      tournamentId: b.tournamentId,
      day: b.day,
      minPoints: b.minPoints,
      maxPoints: b.maxPoints,
      maxPlayers: b.maxPlayers,
      registeredCount: b._count.registrations,
    }));

    const existing = await prisma.playerBracketRegistration.findMany({
      where: { playerId: id, isActive: true },
      select: { bracket: { select: { id: true, name: true, tournamentId: true, day: true } } },
    });

    const violation = findDailyQuotaViolation(
      existing.map((r) => r.bracket),
      requested,
    );
    if (violation) throw new HttpError(400, dailyQuotaMessage(violation));

    // Fenêtre de points : les deux bornes du tableau sont opposables, et le
    // classement doit provenir de la fédération. Le classement retenu est
    // celui de la fiche au moment de la validation, comme le veut le règlement.
    //
    // L'admin y déroge : il gère les cas que le règlement laisse à son
    // appréciation (surclassement, licence en cours de mutation, joueur sans
    // licence accepté sur décision du juge-arbitre). La dérogation est tracée.
    const player = await prisma.player.findUnique({
      where: { id },
      select: { points: true, ffttSyncedAt: true, firstName: true, lastName: true },
    });
    if (!player) throw new HttpError(404, 'Joueur introuvable');

    const window = findPointsWindowViolation(requested, player);
    if (window) {
      if (me.role !== 'admin') throw new HttpError(400, pointsWindowMessage(window));
      console.warn(
        `[inscriptions] dérogation admin — ${player.lastName} ${player.firstName} (${window.points} pts, motif ${window.reason}) inscrit sur « ${window.bracket.name} » [${window.bracket.minPoints ?? '−'} ; ${window.bracket.maxPoints ?? '−'}]`,
      );
    }

    const created = [];
    for (const bracketId of bracketIds) {
      const reg = await prisma.playerBracketRegistration.upsert({
        where: { playerId_bracketId: { playerId: id, bracketId } },
        update: { isActive: true },
        create: {
          playerId: id,
          bracketId,
          qrToken: crypto.randomBytes(32).toString('base64url'),
        },
      });
      created.push(reg);
    }
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}
