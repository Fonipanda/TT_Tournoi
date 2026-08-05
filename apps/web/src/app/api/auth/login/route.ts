/**
 * POST /api/auth/login
 *
 * Body : { identifier: string, password: string, mode?: 'admin' | 'player' }
 *  - identifier = username | email | licence FFTT
 *  - password TOUJOURS requis (staff comme joueurs)
 *
 * Protections :
 *  - rate limiting par IP et par identifiant (anti brute-force)
 *  - message d'erreur unique + vérification à blanc (anti-énumération)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { verifyPassword, fakeVerifyPassword } from '@tt/auth/password';
import { issueTokens, setAuthCookies, errorResponse, HttpError } from '@/lib/auth/server';
import { clientIp, enforceRateLimits, resetRateLimit } from '@/lib/rate-limit';
import type { LoginResponse } from '@tt/types';

const LoginSchema = z.object({
  identifier: z.string().min(1, 'Identifiant requis').max(255),
  password: z.string().min(1, 'Mot de passe requis').max(128),
  mode: z.enum(['admin', 'player']).optional(),
});

const INVALID_CREDENTIALS = 'Identifiant ou mot de passe incorrect.';

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const parsed = LoginSchema.safeParse(await req.json());

    const identifierKey = parsed.success
      ? parsed.data.identifier.trim().toLowerCase()
      : 'invalid';

    const limited = await enforceRateLimits([
      { key: `login:ip:${ip}`, limit: 20, windowSec: 900 },
      { key: `login:id:${identifierKey}`, limit: 5, windowSec: 900 },
    ]);
    if (limited) return limited;

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Identifiant et mot de passe requis', code: 'validation' },
        { status: 400 },
      );
    }

    const identifier = parsed.data.identifier.trim();
    const { password } = parsed.data;

    const user = await findAccount(identifier);

    // Compte inconnu, désactivé ou sans mot de passe utilisable : on effectue
    // quand même un calcul argon2 pour égaliser le temps de réponse, puis on
    // renvoie l'erreur générique (pas d'énumération de comptes).
    if (!user || !user.isActive || !user.passwordHash) {
      await fakeVerifyPassword(password);
      throw new HttpError(401, INVALID_CREDENTIALS, 'invalid_credentials');
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      throw new HttpError(401, INVALID_CREDENTIALS, 'invalid_credentials');
    }

    // Authentification réussie → compteur anti brute-force remis à zéro.
    await resetRateLimit(`login:id:${identifierKey}`);

    const ua = req.headers.get('user-agent') ?? undefined;
    const { accessToken, refreshToken } = await issueTokens({
      userId: user.id,
      role: user.role,
      username: user.username,
      playerId: user.playerId,
      userAgent: ua,
      ip,
    });
    await setAuthCookies(accessToken, refreshToken);

    const res: LoginResponse = {
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        playerId: user.playerId,
        passwordNeedsReset: user.passwordNeedsReset,
      },
    };
    return NextResponse.json(res);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Données invalides', details: e.errors, code: 'validation' },
        { status: 400 },
      );
    }
    return errorResponse(e);
  }
}

/**
 * Résout un compte à partir d'un username, d'un email ou d'un numéro de
 * licence FFTT. Retourne `null` si aucun compte ne correspond.
 */
async function findAccount(identifier: string) {
  const direct = await prisma.userAccount.findFirst({
    where: {
      OR: [{ username: identifier }, { email: { equals: identifier, mode: 'insensitive' } }],
    },
  });
  if (direct) return direct;

  // Licence FFTT → compte du joueur correspondant
  if (/^\d{6,10}$/.test(identifier)) {
    const player = await prisma.player.findUnique({
      where: { licenseNumber: identifier },
      select: { account: true },
    });
    return player?.account ?? null;
  }

  return null;
}
