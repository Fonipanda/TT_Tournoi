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
