/**
 * POST /api/auth/forgot-password — demande de réinitialisation par email.
 *
 * Réponse toujours identique (200 + ok) que le compte existe ou non, afin de
 * ne pas permettre l'énumération des adresses email enregistrées.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { errorResponse } from '@/lib/auth/server';
import {
  createPasswordResetToken,
  RESET_TOKEN_TTL_MINUTES,
} from '@/lib/auth/password-reset';
import { appUrl, sendPasswordResetEmail } from '@/lib/mailer';
import { clientIp, enforceRateLimits } from '@/lib/rate-limit';

const Schema = z.object({
  email: z.string().email('Adresse email invalide').max(255),
});

/** Réponse neutre, volontairement identique dans tous les cas. */
const NEUTRAL_RESPONSE = {
  ok: true,
  message:
    "Si un compte est associé à cette adresse, un email de réinitialisation vient d'être envoyé.",
};

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const parsed = Schema.safeParse(await req.json());

    // Même en cas d'email invalide on consomme du quota (anti-balayage).
    const limited = await enforceRateLimits([
      { key: `forgot:ip:${ip}`, limit: 10, windowSec: 900 },
      ...(parsed.success
        ? [{ key: `forgot:mail:${parsed.data.email.toLowerCase()}`, limit: 3, windowSec: 900 }]
        : []),
    ]);
    if (limited) return limited;

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Adresse email invalide', code: 'validation' },
        { status: 400 },
      );
    }

    const email = parsed.data.email.trim();

    const user = await prisma.userAccount.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, isActive: true },
      include: { player: { select: { firstName: true } } },
    });

    if (user?.email) {
      const token = await createPasswordResetToken(user.id, ip);
      const resetUrl = `${appUrl()}/reinitialiser-mot-de-passe?token=${encodeURIComponent(token)}`;
      const result = await sendPasswordResetEmail(
        user.email,
        resetUrl,
        user.player?.firstName ?? user.username,
        RESET_TOKEN_TTL_MINUTES,
      );
      if (!result.delivered) {
        console.error(
          `[forgot-password] Email non délivré pour ${user.id} (${result.reason ?? 'inconnu'})`,
        );
      }
    }

    return NextResponse.json(NEUTRAL_RESPONSE);
  } catch (e) {
    return errorResponse(e);
  }
}
