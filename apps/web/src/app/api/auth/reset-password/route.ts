/**
 * GET  /api/auth/reset-password?token=…  — vérifie qu'un lien est encore valide.
 * POST /api/auth/reset-password          — définit le nouveau mot de passe.
 *
 * Le token est à usage unique. Après changement, toutes les sessions ouvertes
 * de l'utilisateur sont révoquées.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { hashPassword, PASSWORD_POLICY_MESSAGE, isPasswordStrong } from '@tt/auth/password';
import { errorResponse, revokeAllUserRefreshTokens } from '@/lib/auth/server';
import { consumePasswordResetToken, isResetTokenUsable } from '@/lib/auth/password-reset';
import { sendPasswordChangedEmail } from '@/lib/mailer';
import { clientIp, enforceRateLimits } from '@/lib/rate-limit';

const Schema = z.object({
  token: z.string().min(10).max(512),
  password: z.string().min(1, 'Mot de passe requis').max(128),
});

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') ?? '';
  const ip = clientIp(req);

  const limited = await enforceRateLimits([
    { key: `reset-check:ip:${ip}`, limit: 30, windowSec: 900 },
  ]);
  if (limited) return limited;

  return NextResponse.json({ valid: await isResetTokenUsable(token) });
}

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);

    const limited = await enforceRateLimits([
      { key: `reset:ip:${ip}`, limit: 10, windowSec: 900 },
    ]);
    if (limited) return limited;

    const parsed = Schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Requête invalide', code: 'validation' },
        { status: 400 },
      );
    }

    const { token, password } = parsed.data;

    if (!isPasswordStrong(password)) {
      return NextResponse.json(
        { error: PASSWORD_POLICY_MESSAGE, code: 'weak_password' },
        { status: 400 },
      );
    }

    const consumed = await consumePasswordResetToken(token);
    if (!consumed) {
      return NextResponse.json(
        {
          error: 'Ce lien de réinitialisation est invalide ou a expiré. Refais une demande.',
          code: 'invalid_token',
        },
        { status: 400 },
      );
    }

    await prisma.userAccount.update({
      where: { id: consumed.userId },
      data: {
        passwordHash: await hashPassword(password),
        passwordNeedsReset: false,
      },
    });

    // Le mot de passe a changé : toutes les sessions existantes sont coupées.
    await revokeAllUserRefreshTokens(consumed.userId);

    if (consumed.email) {
      void sendPasswordChangedEmail(consumed.email, consumed.username);
    }

    return NextResponse.json({
      ok: true,
      message: 'Mot de passe mis à jour. Tu peux maintenant te connecter.',
    });
  } catch (e) {
    return errorResponse(e);
  }
}
