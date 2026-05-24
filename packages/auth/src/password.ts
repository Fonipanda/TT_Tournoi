/**
 * Password — hash + verify avec argon2id (OWASP 2024 recommendation).
 *
 * Note : argon2 utilise du natif Node.js — NE JAMAIS importer ce module
 * dans un fichier middleware Next.js (Edge Runtime).
 */

import argon2 from 'argon2';
import crypto from 'node:crypto';

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 Mo
  timeCost: 3,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 6) {
    throw new Error('Le mot de passe doit faire au moins 6 caractères.');
  }
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash || !password) return false;
  try {
    return await argon2.verify(hash, password, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

/**
 * Génère un token de refresh aléatoire (cryptographiquement sûr).
 * Le hash sha256 sera stocké en DB ; le token brut envoyé au client.
 */
export function generateRefreshTokenString(): { token: string; hash: string } {
  const token = crypto.randomBytes(48).toString('base64url');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
