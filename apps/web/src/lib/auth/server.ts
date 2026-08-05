/**
 * Helpers serveur pour l'authentification dans les Route Handlers (Node.js).
 *
 * À utiliser dans les `app/api/.../route.ts`.
 * Importe argon2/Prisma → NE PAS utiliser dans le middleware (Edge).
 */

import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  verifyAccessToken,
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
} from '@tt/auth/jwt';
import { hashToken, hashRefreshToken } from '@tt/auth/password';
import { ForbiddenError, UnauthorizedError, hasRole } from '@tt/auth/rbac';
import type { AuthenticatedUser, Role } from '@tt/types';
import { prisma } from '@tt/db';

export const ACCESS_COOKIE = 'tt_access';
export const REFRESH_COOKIE = 'tt_refresh';

const isProd = process.env.NODE_ENV === 'production';

const ACCESS_COOKIE_MAX_AGE = 15 * 60; // 15 min
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 3600; // 7 j

const ACCESS_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProd,
  path: '/',
  maxAge: ACCESS_COOKIE_MAX_AGE,
} as const;

const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProd,
  path: '/',
  maxAge: REFRESH_COOKIE_MAX_AGE,
} as const;

// -----------------------------------------------------------------------------
// Cookies
// -----------------------------------------------------------------------------

export async function setAuthCookies(accessToken: string, refreshToken: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, accessToken, ACCESS_COOKIE_OPTIONS);
  cookieStore.set(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTIONS);
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

  // Le `jti` est généré en amont pour pouvoir signer le JWT AVANT l'insertion,
  // et donc stocker le hash du token réellement remis au client (permet la
  // détection de réutilisation en plus de la révocation par jti).
  const jti = randomUUID();
  const refreshJwt = await signRefreshToken({ sub: input.userId, jti });
  const expiresAt = new Date(Date.now() + REFRESH_COOKIE_MAX_AGE * 1000);

  await prisma.refreshToken.create({
    data: {
      id: jti,
      userId: input.userId,
      tokenHash: hashToken(refreshJwt),
      userAgent: input.userAgent ?? null,
      ip: input.ip ?? null,
      expiresAt,
    },
  });

  return { accessToken: access, refreshToken: refreshJwt };
}

export async function revokeRefreshTokenById(jti: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { id: jti, revokedAt: null },
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
 * Retourne null si refresh invalide / révoqué / expiré / réutilisé.
 *
 * Applique la rotation : le refresh présenté est révoqué et remplacé par un
 * nouveau. Si un refresh déjà révoqué est présenté (rejeu d'un token volé),
 * TOUTES les sessions de l'utilisateur sont invalidées.
 */
export async function tryRefreshTokens(): Promise<{ user: AuthenticatedUser } | null> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;

  let claims;
  try {
    claims = await verifyRefreshToken(refreshToken);
  } catch {
    return null;
  }

  if (!claims.jti) return null;

  const dbToken = await prisma.refreshToken.findUnique({
    where: { id: claims.jti },
    include: { user: true },
  });
  if (!dbToken) return null;

  // Le token présenté doit être exactement celui qui a été émis.
  if (dbToken.tokenHash !== hashToken(refreshToken)) return null;

  // Rejeu d'un refresh déjà révoqué → compromission probable : on coupe tout.
  if (dbToken.revokedAt) {
    console.warn(`[auth] Réutilisation d'un refresh token révoqué (user ${dbToken.userId})`);
    await revokeAllUserRefreshTokens(dbToken.userId);
    return null;
  }

  if (dbToken.expiresAt < new Date()) return null;
  if (!dbToken.user.isActive) return null;

  // Rotation : l'ancien refresh est révoqué, un nouveau couple est émis.
  await revokeRefreshTokenById(dbToken.id);
  const { accessToken, refreshToken: nextRefresh } = await issueTokens({
    userId: dbToken.user.id,
    role: dbToken.user.role,
    username: dbToken.user.username,
    playerId: dbToken.user.playerId,
    userAgent: dbToken.userAgent ?? undefined,
    ip: dbToken.ip ?? undefined,
  });

  cookieStore.set(ACCESS_COOKIE, accessToken, ACCESS_COOKIE_OPTIONS);
  cookieStore.set(REFRESH_COOKIE, nextRefresh, REFRESH_COOKIE_OPTIONS);

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
