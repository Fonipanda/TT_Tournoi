/**
 * POST /api/spid/restore
 *
 * Restaure une sauvegarde JSON exportée via /api/spid/backup.
 * Body : { tournament: {...} } (le payload exporté).
 * ATTENTION : opération destructive, écrase les données du tournoi cible.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@tt/db';
import { requireRole, errorResponse, HttpError } from '@/lib/auth/server';

interface RestoreBody {
  tournament: {
    id: string;
    name: string;
    brackets?: Array<{
      id: string;
      matches?: Array<{
        id: string;
        winnerId?: string | null;
        status: string;
        scoreP1?: number;
        scoreP2?: number;
        setsP1?: number;
        setsP2?: number;
        sets?: unknown;
        startTime?: string | null;
        endTime?: string | null;
      }>;
    }>;
  };
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(['admin']);
    const body = (await req.json()) as RestoreBody;

    if (!body?.tournament?.id) {
      throw new HttpError(400, 'Format de sauvegarde invalide');
    }

    const target = await prisma.tournament.findUnique({ where: { id: body.tournament.id } });
    if (!target) {
      throw new HttpError(404, 'Tournoi cible introuvable (sauvegarde antérieure ?)');
    }

    // Restauration ciblée : statuts de matches et scores uniquement.
    // Cela évite les conflits FK et garde la sécurité (pas de création joueurs).
    let matchesUpdated = 0;
    for (const bracket of body.tournament.brackets ?? []) {
      for (const m of bracket.matches ?? []) {
        try {
          await prisma.match.update({
            where: { id: m.id },
            data: {
              winnerId: m.winnerId ?? null,
              status: m.status as 'waiting' | 'in_progress' | 'finished' | 'blocked',
              scoreP1: m.scoreP1 ?? 0,
              scoreP2: m.scoreP2 ?? 0,
              setsP1: m.setsP1 ?? 0,
              setsP2: m.setsP2 ?? 0,
              sets: (m.sets ?? []) as never,
              startTime: m.startTime ? new Date(m.startTime) : null,
              endTime: m.endTime ? new Date(m.endTime) : null,
            },
          });
          matchesUpdated++;
        } catch {
          /* skip missing match */
        }
      }
    }

    return NextResponse.json({ ok: true, matchesUpdated });
  } catch (e) {
    return errorResponse(e);
  }
}
