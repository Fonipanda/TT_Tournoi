/**
 * GET /api/export/pointage/:bracketId
 *
 * Exporte la liste des inscrits présents au format CSV (UTF-8 BOM)
 * au format SPIDD/OTC : `inscritsPresentsDossardsTab_<TABLEAU>.csv`
 * Colonnes : Dossard, NumLicence, Nom, Prenom, Points, Club
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@tt/db';
import { requireRole, errorResponse } from '@/lib/auth/server';

interface Params { params: Promise<{ bracketId: string }> }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requireRole(['admin', 'juge_arbitre']);
    const { bracketId } = await params;

    const bracket = await prisma.bracket.findUnique({
      where: { id: bracketId },
      include: {
        registrations: {
          where: { isActive: true, checkinStatus: 'present' },
          include: { player: true },
          orderBy: { dossardNumber: 'asc' },
        },
      },
    });
    if (!bracket) {
      return NextResponse.json({ error: 'Tableau introuvable' }, { status: 404 });
    }

    const safe = (s: string | null | undefined) =>
      (s ?? '').replace(/"/g, '""').replace(/[\r\n]+/g, ' ');

    const lines: string[] = [];
    lines.push(['Dossard', 'NumLicence', 'Nom', 'Prenom', 'Points', 'Club'].join(';'));
    for (const r of bracket.registrations) {
      const p = r.player;
      lines.push([
        r.dossardNumber ?? '',
        `"${safe(p.licenseNumber)}"`,
        `"${safe(p.lastName)}"`,
        `"${safe(p.firstName)}"`,
        Math.round(p.points),
        `"${safe(p.club)}"`,
      ].join(';'));
    }

    // BOM UTF-8 + CRLF (Excel-friendly)
    const body = '\uFEFF' + lines.join('\r\n') + '\r\n';
    const safeName = bracket.name.replace(/[^\w\-]+/g, '_');
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="inscritsPresentsDossardsTab_${safeName}.csv"`,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
