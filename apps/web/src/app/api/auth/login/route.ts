/**
 * POST /api/auth/login
 *
 * Body : { identifier: string, password?: string, licence?: string }
 *  - identifier = username | email | licence FFTT
 *  - password requis pour admin / juge_arbitre
 *  - licence : si pas de compte trouvé et identifier est numérique, tente
 *    une autocréation joueur via FFTT lookup (logique du dépôt B)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@tt/db';
import { verifyPassword } from '@tt/auth/password';
import { issueTokens, setAuthCookies, errorResponse, HttpError } from '@/lib/auth/server';
import { lookupFfttPlayer, FfttError } from '@/lib/fftt/client';
import type { LoginResponse } from '@tt/types';

const LoginSchema = z.object({
  identifier: z.string().min(1, 'Identifiant requis'),
  password: z.string().optional(),
  mode: z.enum(['admin', 'player']).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = LoginSchema.parse(await req.json());
    const identifier = body.identifier.trim();

    // Cas 1 : login par licence FFTT (player mode, pas de password)
    if (body.mode === 'player' && /^\d{6,10}$/.test(identifier)) {
      return await loginByLicence(identifier, req);
    }

    // Cas 2 : login admin/JA par username + password
    if (!body.password) {
      throw new HttpError(400, 'Mot de passe requis', 'password_required');
    }

    const user = await prisma.userAccount.findFirst({
      where: {
        OR: [{ username: identifier }, { email: identifier }],
        isActive: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw new HttpError(401, 'Identifiants invalides', 'invalid_credentials');
    }

    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) {
      throw new HttpError(401, 'Identifiants invalides', 'invalid_credentials');
    }

    const ua = req.headers.get('user-agent') ?? undefined;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined;

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
 * Login par licence FFTT — autocrée le joueur + le UserAccount si besoin.
 * Pas de mot de passe : la connexion se fait à la licence (sécurité v1
 * volontairement légère, à renforcer si besoin avec OTP SMS plus tard).
 */
async function loginByLicence(licence: string, req: NextRequest) {
  let player = await prisma.player.findUnique({ where: { licenseNumber: licence } });

  if (!player) {
    let fftt;
    try {
      fftt = await lookupFfttPlayer(licence);
    } catch (e) {
      if (e instanceof FfttError) {
        throw new HttpError(e.status, e.message, 'fftt_error');
      }
      throw e;
    }
    player = await prisma.player.create({
      data: {
        firstName: fftt.prenom,
        lastName: fftt.nom,
        licenseNumber: fftt.licence,
        points: fftt.points,
        club: fftt.club ?? '',
        email: '',
      },
    });
  }

  let account = await prisma.userAccount.findUnique({ where: { playerId: player.id } });
  if (!account) {
    account = await prisma.userAccount.create({
      data: {
        username: `licence-${player.licenseNumber}`,
        passwordHash: '', // pas de password pour les joueurs en v1
        role: 'player',
        playerId: player.id,
      },
    });
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

  const res: LoginResponse = {
    user: {
      id: account.id,
      username: account.username,
      role: 'player',
      playerId: player.id,
    },
  };
  return NextResponse.json(res);
}
