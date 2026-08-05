/**
 * POST /api/auth/register — inscription publique (sans login préalable).
 *
 * Crée un Player + un UserAccount role=player protégé par mot de passe.
 * Permet à un joueur sans licence FFTT (ou avec une licence introuvable) de
 * s'inscrire.
 *
 * Body : { firstName, lastName, email, password, phone?, licenseNumber?, club? }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { hashPassword, isPasswordStrong, PASSWORD_POLICY_MESSAGE } from '@tt/auth/password';
import { issueTokens, setAuthCookies, errorResponse, HttpError } from '@/lib/auth/server';
import { clientIp, enforceRateLimits } from '@/lib/rate-limit';

const Schema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email('Adresse email invalide').max(255),
  password: z.string().min(1, 'Mot de passe requis').max(128),
  phone: z.string().min(8).max(20).optional().or(z.literal('')),
  licenseNumber: z
    .string()
    .regex(/^\d{6,10}$/)
    .optional()
    .or(z.literal('')),
  club: z.string().max(100).optional().or(z.literal('')),
});

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const limited = await enforceRateLimits([
      { key: `register:ip:${ip}`, limit: 5, windowSec: 3600 },
    ]);
    if (limited) return limited;

    const body = Schema.parse(await req.json());
    const email = body.email.trim();

    if (!isPasswordStrong(body.password)) {
      throw new HttpError(400, PASSWORD_POLICY_MESSAGE, 'weak_password');
    }

    // Une licence ou un email déjà utilisés ne peuvent pas être réinscrits.
    const existingPlayer = await prisma.player.findFirst({
      where: {
        OR: [
          ...(body.licenseNumber ? [{ licenseNumber: body.licenseNumber }] : []),
          { email: { equals: email, mode: 'insensitive' as const } },
        ],
      },
    });
    const existingAccount = await prisma.userAccount.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existingPlayer || existingAccount) {
      throw new HttpError(
        409,
        'Un compte existe déjà avec cette licence ou cet email. Connecte-toi ou utilise « Mot de passe oublié ».',
        'duplicate',
      );
    }

    const passwordHash = await hashPassword(body.password);

    // Créer le joueur
    const player = await prisma.player.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName.toUpperCase(),
        email,
        phone: body.phone || null,
        licenseNumber: body.licenseNumber || null,
        club: body.club || '',
        points: 500, // valeur par défaut, modifiable plus tard
      },
    });

    // Créer le compte UserAccount lié
    const username = body.licenseNumber
      ? `licence-${body.licenseNumber}`
      : `email-${email.replace(/[^a-z0-9]/gi, '_').slice(0, 30)}`;
    const account = await prisma.userAccount.create({
      data: {
        username,
        email,
        passwordHash,
        role: 'player',
        playerId: player.id,
        passwordNeedsReset: false,
      },
    });

    // Auto-login
    const ua = req.headers.get('user-agent') ?? undefined;
    const { accessToken, refreshToken } = await issueTokens({
      userId: account.id,
      role: 'player',
      username: account.username,
      playerId: player.id,
      userAgent: ua,
      ip,
    });
    await setAuthCookies(accessToken, refreshToken);

    return NextResponse.json(
      {
        user: {
          id: account.id,
          username: account.username,
          role: 'player',
          playerId: player.id,
        },
        player: {
          id: player.id,
          firstName: player.firstName,
          lastName: player.lastName,
        },
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation', details: e.errors, code: 'validation' },
        { status: 400 },
      );
    }
    return errorResponse(e);
  }
}
