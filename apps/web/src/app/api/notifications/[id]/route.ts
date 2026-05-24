/**
 * PATCH /api/notifications/:id   — toggle isRead
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { errorResponse, getCurrentUser, HttpError } from '@/lib/auth/server';

interface Params { params: Promise<{ id: string }> }

const Schema = z.object({ isRead: z.boolean() });

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const me = await getCurrentUser();
    if (!me?.playerId) throw new HttpError(403, 'Réservé aux joueurs');
    const { id } = await params;
    const body = Schema.parse(await req.json());

    // Ownership check
    const notif = await prisma.notification.findUnique({ where: { id } });
    if (!notif || notif.playerId !== me.playerId) {
      throw new HttpError(404, 'Introuvable');
    }
    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: body.isRead },
    });
    return NextResponse.json(updated);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors }, { status: 400 });
    }
    return errorResponse(e);
  }
}
