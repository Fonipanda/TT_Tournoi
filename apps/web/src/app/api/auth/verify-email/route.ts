/**
 * POST /api/auth/verify-email — confirme une adresse et active le compte.
 *
 * Body : { token }
 * Réponses : 200 { status: 'verified' | 'already_verified' } | 400 invalide.
 * Aucune session n'est ouverte : l'utilisateur se connecte ensuite normalement.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { errorResponse, HttpError } from '@/lib/auth/server';
import { clientIp, enforceRateLimits } from '@/lib/rate-limit';
import { consumeEmailVerificationToken } from '@/lib/auth/email-verification';

const Schema = z.object({ token: z.string().min(1).max(256) });

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const limited = await enforceRateLimits([
      { key: `verify-email:ip:${ip}`, limit: 20, windowSec: 3600 },
    ]);
    if (limited) return limited;

    const { token } = Schema.parse(await req.json());
    const outcome = await consumeEmailVerificationToken(token);

    if (outcome.status === 'invalid') {
      throw new HttpError(
        400,
        'Ce lien de confirmation est invalide ou a expiré. Demande un nouvel email d’activation.',
        'invalid_token',
      );
    }

    return NextResponse.json({ status: outcome.status });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Lien de confirmation invalide.', code: 'invalid_token' },
        { status: 400 },
      );
    }
    return errorResponse(e);
  }
}
