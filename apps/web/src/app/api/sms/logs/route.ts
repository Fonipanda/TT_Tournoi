/**
 * GET /api/sms/logs?status=&playerId=&limit=
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';

export async function GET(req: NextRequest) {
  try {
    await requireRole(['admin']);
    const sp = req.nextUrl.searchParams;
    const where: Record<string, unknown> = {};
    if (sp.get('status')) where.status = sp.get('status');
    if (sp.get('playerId')) where.playerId = sp.get('playerId');
    if (sp.get('phone')) where.recipientPhone = { contains: sp.get('phone') };
    const limit = Math.min(Number(sp.get('limit') ?? 200), 500);

    const logs = await prisma.smsLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { player: true },
    });
    return NextResponse.json({ data: logs });
  } catch (e) {
    return errorResponse(e);
  }
}
