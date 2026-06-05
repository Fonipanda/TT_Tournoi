/**
 * GET /api/spid/backup
 *
 * Exporte une sauvegarde JSON complète du tournoi actif :
 * tournoi, brackets, registrations, players, matches, rooms, tables.
 * Inspiré de OTC Sauvegardes (sauv_INSCRIPTIONS / sauv_SPIDD / sauv_TABLES).
 *
 * Le fichier généré peut être restauré via POST /api/spid/restore.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@tt/db';
import { requireRole, errorResponse } from '@/lib/auth/server';

export async function GET() {
  try {
    await requireRole(['admin', 'juge_arbitre']);

    const tournament = await prisma.tournament.findFirst({
      where: { isActive: true },
      include: {
        brackets: {
          include: {
            registrations: { include: { player: true } },
            matches: true,
          },
        },
        rooms: {
          include: { tables: true },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Aucun tournoi actif' }, { status: 404 });
    }

    const payload = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      tournament,
    };

    const body = JSON.stringify(payload, null, 2);
    const safeName = tournament.name.replace(/[^\w\-]+/g, '_');
    const dateStr = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="backup_${safeName}_${dateStr}.json"`,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
