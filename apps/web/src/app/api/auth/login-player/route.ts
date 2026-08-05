/**
 * POST /api/auth/login-player
 *
 * Login joueur par licence FFTT + mot de passe, SANS vérifier l'inscription
 * à un tournoi. Utilisé sur la page /inscription pour permettre à un joueur
 * déjà créé (mais sans inscription) de revenir sélectionner ses tableaux.
 *
 * Body : { licence: string, password: string }
 * Réponses :
 *   200 → { user } + cookies
 *   401 'invalid_credentials' → licence inconnue ou mot de passe incorrect
 *   404 'not_registered'      → aucun joueur avec cette licence
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { verifyPassword, fakeVerifyPassword } from '@tt/auth/password';
import { issueTokens, setAuthCookies, errorResponse, HttpError } from '@/lib/auth/server';
import { clientIp, enforceRateLimits, resetRateLimit } from '@/lib/rate-limit';

const Schema = z.object({
  licence: z.string().regex(/^\d{6,10}$/),
  password: z.string().min(1, 'Mot de passe requis').max(128),
});

const INVALID_CREDENTIALS = 'Licence ou mot de passe incorrect.';

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const parsed = Schema.safeParse(await req.json());
    const licenceKey = parsed.success ? parsed.data.licence : 'invalid';

    const limited = await enforceRateLimits([
      { key: `login:ip:${ip}`, limit: 20, windowSec: 900 },
      { key: `login:id:${licenceKey}`, limit: 5, windowSec: 900 },
    ]);
    if (limited) return limited;

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Licence et mot de passe requis', code: 'validation' },
        { status: 400 },
      );
    }

    const { licence, password } = parsed.data;

    const player = await prisma.player.findUnique({
      where: { licenseNumber: licence },
      select: { id: true, account: true },
    });

    // Licence totalement inconnue → le frontend redirige vers /register.
    if (!player) {
      await fakeVerifyPassword(password);
      throw new HttpError(404, 'Aucun compte trouvé avec cette licence', 'not_registered');
    }

    const account = player.account;
    if (!account || !account.isActive || !account.passwordHash) {
      await fakeVerifyPassword(password);
      throw new HttpError(401, INVALID_CREDENTIALS, 'invalid_credentials');
    }

    const ok = await verifyPassword(password, account.passwordHash);
    if (!ok) {
      throw new HttpError(401, INVALID_CREDENTIALS, 'invalid_credentials');
    }

    await resetRateLimit(`login:id:${licenceKey}`);

    const ua = req.headers.get('user-agent') ?? undefined;
    const { accessToken, refreshToken } = await issueTokens({
      userId: account.id,
      role: account.role,
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
        role: account.role,
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
