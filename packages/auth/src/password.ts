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

// -----------------------------------------------------------------------------
// Politique de mot de passe
// -----------------------------------------------------------------------------
// Définie dans un module pur (`password-policy.ts`) pour rester importable
// depuis les composants client React, où argon2 est indisponible.

export {
  PASSWORD_MIN_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_POLICY_MESSAGE,
  PASSWORD_RULES,
  PasswordPolicyError,
  validatePassword,
  isPasswordStrong,
  assertPasswordPolicy,
} from './password-policy';

import { assertPasswordPolicy } from './password-policy';

// -----------------------------------------------------------------------------
// Hash / verify
// -----------------------------------------------------------------------------

export async function hashPassword(password: string): Promise<string> {
  assertPasswordPolicy(password);
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
 * Vérification « à blanc » : effectue un vrai calcul argon2 pour égaliser le
 * temps de réponse quand le compte n'existe pas ou n'a pas de mot de passe.
 * Évite l'oracle temporel permettant d'énumérer les comptes.
 */
let dummyHashPromise: Promise<string> | null = null;

export async function fakeVerifyPassword(password: string): Promise<false> {
  if (!dummyHashPromise) {
    dummyHashPromise = argon2.hash(crypto.randomBytes(32).toString('hex'), ARGON2_OPTIONS);
  }
  try {
    await argon2.verify(await dummyHashPromise, password || 'x', ARGON2_OPTIONS);
  } catch {
    /* attendu : la vérification échoue toujours */
  }
  return false;
}

// -----------------------------------------------------------------------------
// Tokens opaques (refresh, réinitialisation de mot de passe)
// -----------------------------------------------------------------------------

/**
 * Génère un token opaque aléatoire (cryptographiquement sûr).
 * Le hash sha256 est stocké en DB ; le token brut est transmis au destinataire.
 */
export function generateSecureToken(bytes = 48): { token: string; hash: string } {
  const token = crypto.randomBytes(bytes).toString('base64url');
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** @deprecated alias historique — utiliser `generateSecureToken`. */
export function generateRefreshTokenString(): { token: string; hash: string } {
  return generateSecureToken(48);
}

/** @deprecated alias historique — utiliser `hashToken`. */
export function hashRefreshToken(token: string): string {
  return hashToken(token);
}
