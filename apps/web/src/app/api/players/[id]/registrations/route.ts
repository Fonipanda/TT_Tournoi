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
import { dailyQuotaMessage, findDailyQuotaViolation } from '@/lib/registrations';

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

    // Quota FFTT : 2 tableaux par jour et par joueur. Contrôlé côté serveur —
    // la règle appliquée dans le formulaire n'est qu'une aide à la saisie.
    const uniqueIds = [...new Set(bracketIds)];
    const requested = await prisma.bracket.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, name: true, day: true },
    });
    if (requested.length !== uniqueIds.length) {
      throw new HttpError(400, 'Tableau inconnu');
    }

    const existing = await prisma.playerBracketRegistration.findMany({
      where: { playerId: id, isActive: true },
      select: { bracket: { select: { id: true, name: true, day: true } } },
    });

    const violation = findDailyQuotaViolation(
      existing.map((r) => r.bracket),
      requested,
    );
    if (violation) throw new HttpError(400, dailyQuotaMessage(violation));

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
