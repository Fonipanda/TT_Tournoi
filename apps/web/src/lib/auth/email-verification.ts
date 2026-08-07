/**
 * Jetons de confirmation d'adresse email (activation de compte).
 *
 * Même modèle que la réinitialisation de mot de passe : le token brut n'existe
 * que dans l'email, la base ne stocke que son hash sha256. Usage unique,
 * expiration après `VERIFICATION_TOKEN_TTL_HOURS`.
 *
 * Node.js only (Prisma) — ne pas importer dans le middleware Edge.
 */

import { prisma } from '@tt/db';
import { generateSecureToken, hashToken } from '@tt/auth/password';
import { appUrl } from '@/lib/mailer';

export const VERIFICATION_TOKEN_TTL_HOURS = 48;

/**
 * La vérification d'email peut être désactivée (déploiement sans SMTP,
 * environnement de test). Activée par défaut.
 */
export function isEmailVerificationRequired(): boolean {
  return process.env.EMAIL_VERIFICATION_REQUIRED !== 'false';
}

/**
 * Crée un jeton d'activation et invalide les précédents encore valides.
 * Retourne l'URL complète à insérer dans l'email.
 */
export async function createEmailVerificationLink(
  userId: string,
  email: string,
  requestIp?: string | null,
): Promise<string> {
  const now = new Date();

  await prisma.emailVerificationToken.updateMany({
    where: { userId, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });

  const { token, hash } = generateSecureToken(32);
  await prisma.emailVerificationToken.create({
    data: {
      userId,
      tokenHash: hash,
      email,
      expiresAt: new Date(now.getTime() + VERIFICATION_TOKEN_TTL_HOURS * 3600_000),
      requestIp: requestIp ?? null,
    },
  });

  return `${appUrl()}/verifier-email?token=${encodeURIComponent(token)}`;
}

export type VerificationOutcome =
  | { status: 'verified'; username: string; email: string }
  | { status: 'already_verified' }
  | { status: 'invalid' };

/**
 * Consomme un jeton et active le compte.
 *
 * La consommation est atomique : deux clics simultanés sur le lien ne peuvent
 * pas réussir deux fois. Un lien déjà utilisé sur un compte déjà actif renvoie
 * `already_verified` (cas courant : l'utilisateur reclique dans son email).
 */
export async function consumeEmailVerificationToken(
  token: string,
): Promise<VerificationOutcome> {
  if (!token) return { status: 'invalid' };

  const record = await prisma.emailVerificationToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!record) return { status: 'invalid' };
  if (!record.user.isActive) return { status: 'invalid' };

  if (record.usedAt) {
    return record.user.emailVerifiedAt ? { status: 'already_verified' } : { status: 'invalid' };
  }
  if (record.expiresAt < new Date()) return { status: 'invalid' };

  // L'adresse du compte a changé depuis l'envoi → le lien ne vaut plus rien.
  if (record.user.email && record.user.email.toLowerCase() !== record.email.toLowerCase()) {
    return { status: 'invalid' };
  }

  const consumed = await prisma.emailVerificationToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (consumed.count !== 1) {
    return record.user.emailVerifiedAt ? { status: 'already_verified' } : { status: 'invalid' };
  }

  await prisma.userAccount.update({
    where: { id: record.userId },
    data: { emailVerifiedAt: new Date() },
  });

  return { status: 'verified', username: record.user.username, email: record.email };
}
