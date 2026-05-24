/**
 * Helpers serveur pour l'authentification dans les Route Handlers (Node.js).
 *
 * À utiliser dans les `app/api/.../route.ts`.
 * Importe argon2/Prisma → NE PAS utiliser dans le middleware (Edge).
 */

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  verifyAccessToken,
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
  isJwtExpired,
} from '@tt/auth/jwt';
import { hashRefreshToken, generateRefreshTokenString } from '@tt/auth/password';
import { ForbiddenError, UnauthorizedError, hasRole } from '@tt/auth/rbac';
import type { AuthenticatedUser, Role } from '@tt/types';
import { prisma } from '@tt/db';

export const ACCESS_COOKIE = 'tt_access';
export const REFRESH_COOKIE = 'tt_refresh';

const isProd = process.env.NODE_ENV === 'production';

// -----------------------------------------------------------------------------
// Cookies
// -----------------------------------------------------------------------------

export async function setAuthCookies(accessToken: string, refreshToken: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 15 * 60, // 15 min
  });
  cookieStore.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 7 * 24 * 3600, // 7 j
  });
}

export async function clearAuthCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE);
  cookieStore.delete(REFRESH_COOKIE);
}

// -----------------------------------------------------------------------------
// Génération token + refresh persisté en DB
// -----------------------------------------------------------------------------

export interface IssueTokensInput {
  userId: string;
  role: Role;
  username: string;
  playerId?: string | null;
  userAgent?: string;
  ip?: string;
}

export async function issueTokens(input: IssueTokensInput): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const access = await signAccessToken({
    sub: input.userId,
    role: input.role,
    username: input.username,
    playerId: input.playerId,
  });

  const { token: refreshRaw, hash } = generateRefreshTokenString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);

  const dbToken = await prisma.refreshToken.create({
    data: {
      userId: input.userId,
      tokenHash: hash,
      userAgent: input.userAgent ?? null,
      ip: input.ip ?? null,
      expiresAt,
    },
  });

  // Le refresh JWT contient { sub, jti } — pas le token brut
  const refreshJwt = await signRefreshToken({ sub: input.userId, jti: dbToken.id });

  // On envoie au client le JWT signé (pas le refreshRaw — il est seulement
  // gardé côté DB sous forme de hash pour révocation)
  // NOTE: simplification : ici on signe directement le refresh JWT et c'est
  // le `jti` qui sert de clef de révocation (pas besoin de gérer 2 secrets).
  // Le refreshRaw n'est PAS utilisé côté client → on le brûle.
  void refreshRaw;

  return { accessToken: access, refreshToken: refreshJwt };
}

export async function revokeRefreshTokenById(jti: string): Promise<void> {
  await prisma.refreshToken.update({
    where: { id: jti },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// -----------------------------------------------------------------------------
// Récupérer l'utilisateur courant depuis les cookies
// -----------------------------------------------------------------------------

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    const claims = await verifyAccessToken(token);
    return {
      userId: claims.sub,
      role: claims.role,
      username: claims.username,
      playerId: claims.playerId ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Tente de rafraîchir l'access token depuis le refresh JWT en cookie.
 * Retourne null si refresh invalide / révoqué / expiré.
 */
export async function tryRefreshTokens(): Promise<{ user: AuthenticatedUser } | null> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  let claims;
  try {
    claims = await verifyRefreshToken(refreshToken);
  } catch (e) {
    if (isJwtExpired(e)) return null;
    return null;
  }

  if (!claims.jti) return null;

  // Vérifier que le refresh n'a pas été révoqué côté DB
  const dbToken = await prisma.refreshToken.findUnique({
    where: { id: claims.jti },
    include: { user: true },
  });
  if (!dbToken || dbToken.revokedAt || dbToken.expiresAt < new Date()) {
    return null;
  }

  if (!dbToken.user.isActive) return null;

  // Émettre un nouvel access (rotation possible plus tard)
  const access = await signAccessToken({
    sub: dbToken.user.id,
    role: dbToken.user.role,
    username: dbToken.user.username,
    playerId: dbToken.user.playerId,
  });
  cookieStore.set(ACCESS_COOKIE, access, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 15 * 60,
  });

  return {
    user: {
      userId: dbToken.user.id,
      role: dbToken.user.role,
      username: dbToken.user.username,
      playerId: dbToken.user.playerId,
    },
  };
}

// -----------------------------------------------------------------------------
// Garde de Route Handler : requireRole
// -----------------------------------------------------------------------------

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, 'Authentification requise', 'unauthorized');
  return user;
}

export async function requireRole(allowed: readonly Role[]): Promise<AuthenticatedUser> {
  const user = await requireUser();
  if (!hasRole(user.role, allowed)) {
    throw new HttpError(403, 'Accès refusé', 'forbidden');
  }
  return user;
}

/**
 * Helper pour transformer une erreur en réponse Next.js standard.
 */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: err.message, code: 'unauthorized' }, { status: 401 });
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: err.message, code: 'forbidden' }, { status: 403 });
  }
  console.error('[api] Unhandled error:', err);
  return NextResponse.json(
    { error: 'Erreur serveur interne', code: 'internal' },
    { status: 500 },
  );
}

export { hashRefreshToken };
