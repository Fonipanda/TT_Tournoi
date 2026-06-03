/**
 * DELETE /api/brackets/:id/matches?type=pool|elimination
 *
 * Supprime les matches générés (poules et/ou élimination) d'un bracket.
 * Permet de corriger et re-générer.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@tt/db';
import { errorResponse, requireRole } from '@/lib/auth/server';

interface Params { params: Promise<{ id: string }> }

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin']);
    const { id } = await params;
    const url = new URL(req.url);
    const type = url.searchParams.get('type'); // 'pool', 'elimination', or null (all)

    const where: Record<string, unknown> = { bracketId: id };
    if (type === 'pool') {
      where.poolNumber = { not: null };
    } else if (type === 'elimination') {
      where.poolNumber = null;
    }
    // else: delete all matches for this bracket

    // First free the tables (set status back to 'free')
    const matchesWithTables = await prisma.match.findMany({
      where: { ...where, tableId: { not: null } },
      select: { tableId: true },
    });
    const tableIds = matchesWithTables.map((m) => m.tableId).filter(Boolean) as string[];
    if (tableIds.length > 0) {
      await prisma.tableModel.updateMany({
        where: { id: { in: tableIds } },
        data: { status: 'free' },
      });
    }

    // Delete match events first (FK constraint)
    await prisma.matchEvent.deleteMany({ where: { match: where as any } });

    // Delete matches
    const result = await prisma.match.deleteMany({ where });

    return NextResponse.json({ deleted: result.count });
  } catch (e) {
    return errorResponse(e);
  }
}
