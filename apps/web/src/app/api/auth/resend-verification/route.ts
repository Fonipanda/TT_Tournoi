/**
 * POST /api/auth/resend-verification — renvoie le lien d'activation.
 *
 * Body : { email }
 * Réponse toujours 200 avec le même message, quel que soit l'état du compte :
 * cela empêche d'utiliser cette route pour découvrir les emails enregistrés.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { errorResponse } from '@/lib/auth/server';
import { clientIp, enforceRateLimits } from '@/lib/rate-limit';
import { isValidEmailFormat } from '@/lib/email-validation';
import {
  createEmailVerificationLink,
  isEmailVerificationRequired,
  VERIFICATION_TOKEN_TTL_HOURS,
} from '@/lib/auth/email-verification';
import { sendEmailVerificationEmail } from '@/lib/mailer';

const Schema = z.object({ email: z.string().max(254) });

const GENERIC_RESPONSE = {
  message:
    "Si un compte en attente d'activation existe pour cette adresse, un nouvel email vient d'être envoyé.",
};

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const limited = await enforceRateLimits([
      { key: `resend-verification:ip:${ip}`, limit: 5, windowSec: 3600 },
    ]);
    if (limited) return limited;

    const { email: raw } = Schema.parse(await req.json());
    const email = raw.trim();

    if (!isEmailVerificationRequired() || !isValidEmailFormat(email)) {
      return NextResponse.json(GENERIC_RESPONSE);
    }

    // Limite supplémentaire par adresse : empêche d'utiliser le service comme
    // relais d'envoi vers une boîte tierce.
    const perEmail = await enforceRateLimits([
      { key: `resend-verification:email:${email.toLowerCase()}`, limit: 3, windowSec: 3600 },
    ]);
    if (perEmail) return perEmail;

    const account = await prisma.userAccount.findFirst({
      where: {
        email: { equals: email, mode: 'insensitive' },
        emailVerifiedAt: null,
        isActive: true,
      },
      include: { player: { select: { firstName: true } } },
    });

    if (account?.email) {
      const verifyUrl = await createEmailVerificationLink(account.id, account.email, ip);
      const result = await sendEmailVerificationEmail(
        account.email,
        verifyUrl,
        account.player?.firstName,
        VERIFICATION_TOKEN_TTL_HOURS,
      );
      if (!result.delivered) {
        console.error(
          `[resend-verification] Envoi impossible pour ${account.id} (${result.reason ?? 'inconnu'})`,
        );
      }
    }

    return NextResponse.json(GENERIC_RESPONSE);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(GENERIC_RESPONSE);
    }
    return errorResponse(e);
  }
}
