/**
 * JWT — sign / verify access et refresh tokens.
 *
 * Utilise `jose` (Edge-compatible) pour permettre l'utilisation dans le
 * middleware Next.js (Edge Runtime).
 *
 * IMPORTANT : ne pas importer ce module avec argon2/bcrypt qui sont
 * Node-only. Le hashing reste dans `password.ts`.
 */

import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import type {
  JwtAccessClaims,
  JwtRefreshClaims,
  Role,
} from '@tt/types';

const ALG = 'HS256';
const ISSUER = 'tt-tournoi';
const AUDIENCE_ACCESS = 'tt-access';
const AUDIENCE_REFRESH = 'tt-refresh';

function encodeSecret(secret: string): Uint8Array {
  if (!secret || secret.length < 32) {
    throw new Error(
      '[auth] JWT secret must be at least 32 characters long. Configure JWT_ACCESS_SECRET / JWT_REFRESH_SECRET.',
    );
  }
  return new TextEncoder().encode(secret);
}

function getAccessSecret(): Uint8Array {
  return encodeSecret(process.env.JWT_ACCESS_SECRET ?? '');
}

function getRefreshSecret(): Uint8Array {
  return encodeSecret(process.env.JWT_REFRESH_SECRET ?? '');
}

function getAccessTtl(): string {
  return process.env.JWT_ACCESS_TTL || '15m';
}

function getRefreshTtl(): string {
  return process.env.JWT_REFRESH_TTL || '7d';
}

// -----------------------------------------------------------------------------
// Access token
// -----------------------------------------------------------------------------

export interface SignAccessTokenInput {
  sub: string;
  role: Role;
  username?: string;
  playerId?: string | null;
}

export async function signAccessToken(
  input: SignAccessTokenInput,
  ttl: string = getAccessTtl(),
): Promise<string> {
  return new SignJWT({
    role: input.role,
    username: input.username,
    playerId: input.playerId ?? null,
  })
    .setProtectedHeader({ alg: ALG })
    .setSubject(input.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE_ACCESS)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(getAccessSecret());
}

export async function verifyAccessToken(token: string): Promise<JwtAccessClaims> {
  const { payload } = await jwtVerify(token, getAccessSecret(), {
    issuer: ISSUER,
    audience: AUDIENCE_ACCESS,
  });
  return payload as unknown as JwtAccessClaims;
}

// -----------------------------------------------------------------------------
// Refresh token
// -----------------------------------------------------------------------------

export interface SignRefreshTokenInput {
  sub: string;
  /** ID du RefreshToken stocké en DB (pour révocation par jti) */
  jti: string;
}

export async function signRefreshToken(
  input: SignRefreshTokenInput,
  ttl: string = getRefreshTtl(),
): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALG })
    .setSubject(input.sub)
    .setJti(input.jti)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE_REFRESH)
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(getRefreshSecret());
}

export async function verifyRefreshToken(token: string): Promise<JwtRefreshClaims> {
  const { payload } = await jwtVerify(token, getRefreshSecret(), {
    issuer: ISSUER,
    audience: AUDIENCE_REFRESH,
  });
  return payload as unknown as JwtRefreshClaims;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export function isJwtExpired(error: unknown): boolean {
  return error instanceof joseErrors.JWTExpired;
}

export function isJwtInvalid(error: unknown): boolean {
  return (
    error instanceof joseErrors.JWTInvalid ||
    error instanceof joseErrors.JWSInvalid ||
    error instanceof joseErrors.JWTClaimValidationFailed
  );
}
