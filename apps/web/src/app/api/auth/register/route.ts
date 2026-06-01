/**
 * POST /api/auth/register — inscription publique (sans login préalable).
 *
 * Crée un Player + un UserAccount role=player. Permet à un joueur sans
 * licence FFTT (ou avec une licence introuvable) de s'inscrire.
 *
 * Body : { firstName, lastName, email, phone, licenseNumber?, club? }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { issueTokens, setAuthCookies, errorResponse, HttpError } from '@/lib/auth/server';

const Schema = z.object({
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  email: z.string().email(),
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
    const body = Schema.parse(await req.json());

    // Vérifier qu'il n'y a pas déjà un joueur avec cette licence ou cet email
    const existing = await prisma.player.findFirst({
      where: {
        OR: [
          ...(body.licenseNumber ? [{ licenseNumber: body.licenseNumber }] : []),
          { email: body.email },
        ],
      },
    });
    if (existing) {
      throw new HttpError(409, 'Un joueur avec cette licence ou cet email existe déjà', 'duplicate');
    }

    // Créer le joueur
    const player = await prisma.player.create({
      data: {
        firstName: body.firstName,
        lastName: body.lastName.toUpperCase(),
        email: body.email,
        phone: body.phone || null,
        licenseNumber: body.licenseNumber || null,
        club: body.club || '',
        points: 500, // valeur par défaut, modifiable plus tard
      },
    });

    // Créer le compte UserAccount lié
    const username = body.licenseNumber
      ? `licence-${body.licenseNumber}`
      : `email-${body.email.replace(/[^a-z0-9]/gi, '_').slice(0, 30)}`;
    const account = await prisma.userAccount.create({
      data: {
        username,
        email: body.email,
        passwordHash: '', // pas de password (login par licence ou email à venir)
        role: 'player',
        playerId: player.id,
      },
    });

    // Auto-login
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
      player: {
        id: player.id,
        firstName: player.firstName,
        lastName: player.lastName,
      },
    }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation', details: e.errors, code: 'validation' }, { status: 400 });
    }
    return errorResponse(e);
  }
}
