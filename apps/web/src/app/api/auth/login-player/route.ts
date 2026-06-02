/**
 * POST /api/auth/login-player
 *
 * Login par licence FFTT, SANS vérifier l'inscription à un tournoi.
 * Utilisé sur la page /inscription pour permettre à un joueur déjà créé
 * (mais sans inscription) de revenir sélectionner ses tableaux.
 *
 * Body : { licence: string }
 * Réponses :
 *   200 → { user } + cookies
 *   404 'not_registered' → joueur introuvable, frontend redirige vers /register
 *   403 'account_disabled' → compte désactivé
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { issueTokens, setAuthCookies, errorResponse, HttpError } from '@/lib/auth/server';

const Schema = z.object({
  licence: z.string().regex(/^\d{6,10}$/),
});

export async function POST(req: NextRequest) {
  try {
    const { licence } = Schema.parse(await req.json());

    const player = await prisma.player.findUnique({ where: { licenseNumber: licence } });
    if (!player) {
      throw new HttpError(404, 'Aucun compte trouvé avec cette licence', 'not_registered');
    }

    const account = await prisma.userAccount.findUnique({ where: { playerId: player.id } });
    if (!account) {
      throw new HttpError(404, 'Aucun compte trouvé avec cette licence', 'not_registered');
    }

    if (!account.isActive) {
      throw new HttpError(403, 'Compte désactivé', 'account_disabled');
    }

    const ua = req.headers.get('user-agent') ?? undefined;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;
    const { accessToken, refreshToken } = await issueTokens({
      userId: account.id,
      role: 'player',
      username: account.username,
      playerId: player.id,
      userAgent: ua,
      ip,
    });
    await setAuthCookies(accessToken, refreshToken);

    return NextResponse.json({
      user: {
        id: account.id,
        username: account.username,
        role: 'player',
        playerId: player.id,
      },
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Licence invalide', code: 'validation' }, { status: 400 });
    }
    return errorResponse(e);
  }
}
