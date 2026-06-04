/**
 * GET /api/export/spid
 * 
 * Exporte les résultats de matches au format SPID XML (format FFTT).
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
            matches: {
              where: { status: 'finished' },
              include: {
                player1: true,
                player2: true,
              },
              orderBy: [{ roundNumber: 'asc' }, { createdAt: 'asc' }],
            },
          },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Aucun tournoi actif' }, { status: 404 });
    }

    // Build SPID XML
    const lines: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<SPID version="2">',
      `  <Tournoi nom="${escXml(tournament.name)}" date="${tournament.startDate?.toISOString().slice(0, 10) ?? ''}">`,
    ];

    for (const bracket of tournament.brackets) {
      lines.push(`    <Tableau nom="${escXml(bracket.name)}" categorie="${escXml(bracket.category ?? '')}">`);

      for (const match of bracket.matches) {
        if (!match.player1 || !match.player2) continue;
        const sets = Array.isArray(match.sets) ? (match.sets as { p1: number; p2: number }[]) : [];
        const setsStr = sets.map((s) => `${s.p1}-${s.p2}`).join(' ');

        lines.push(`      <Partie>`);
        lines.push(`        <JoueurA licence="${escXml(match.player1.licenseNumber ?? '')}" nom="${escXml(match.player1.lastName)}" prenom="${escXml(match.player1.firstName)}" club="${escXml(match.player1.club ?? '')}" points="${match.player1.points}" />`);
        lines.push(`        <JoueurB licence="${escXml(match.player2.licenseNumber ?? '')}" nom="${escXml(match.player2.lastName)}" prenom="${escXml(match.player2.firstName)}" club="${escXml(match.player2.club ?? '')}" points="${match.player2.points}" />`);
        lines.push(`        <Score setsA="${match.setsP1}" setsB="${match.setsP2}" detail="${escXml(setsStr)}" />`);
        lines.push(`        <Resultat vainqueur="${match.winnerId === match.player1Id ? 'A' : 'B'}" forfait="${match.isForfeit ? 'oui' : 'non'}" />`);
        lines.push(`      </Partie>`);
      }

      lines.push(`    </Tableau>`);
    }

    lines.push('  </Tournoi>');
    lines.push('</SPID>');

    const xml = lines.join('\n');
    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="export-spid-${new Date().toISOString().slice(0, 10)}.xml"`,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
