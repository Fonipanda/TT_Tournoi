/**
 * GET   /api/notifications      — liste pour le joueur courant
 * PATCH /api/notifications/:id  — marquer comme lu
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@tt/db';
import { errorResponse, getCurrentUser, HttpError } from '@/lib/auth/server';

export async function GET(req: NextRequest) {
  try {
    const me = await getCurrentUser();
    if (!me?.playerId) throw new HttpError(403, 'Réservé aux joueurs');
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? 50), 200);
    const unreadOnly = req.nextUrl.searchParams.get('unread') === '1';

    const notifs = await prisma.notification.findMany({
      where: { playerId: me.playerId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const unreadCount = await prisma.notification.count({
      where: { playerId: me.playerId, isRead: false },
    });
    return NextResponse.json({ data: notifs, unreadCount });
  } catch (e) {
    return errorResponse(e);
  }
}
