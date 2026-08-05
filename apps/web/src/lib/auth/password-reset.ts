/**
 * Jetons de réinitialisation de mot de passe.
 *
 * Le token brut n'existe que dans l'email envoyé à l'utilisateur : la base ne
 * contient que son hash sha256. Un token est à usage unique et expire au bout
 * de `RESET_TOKEN_TTL_MINUTES`.
 *
 * Node.js only (Prisma) — ne pas importer dans le middleware Edge.
 */

import { prisma } from '@tt/db';
import { generateSecureToken, hashToken } from '@tt/auth/password';

export const RESET_TOKEN_TTL_MINUTES = 60;

/**
 * Crée un jeton de réinitialisation pour un compte et invalide les jetons
 * précédents encore actifs (un seul lien valide à la fois).
 * Retourne le token brut à insérer dans l'email.
 */
export async function createPasswordResetToken(
  userId: string,
  requestIp?: string | null,
): Promise<string> {
  const now = new Date();

  // Invalide les demandes précédentes non consommées.
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });

  const { token, hash } = generateSecureToken(32);
  await prisma.passwordResetToken.create({
    data: {
      userId,
      tokenHash: hash,
      expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MINUTES * 60_000),
      requestIp: requestIp ?? null,
    },
  });

  return token;
}

export interface ConsumedResetToken {
  userId: string;
  email: string | null;
  username: string;
}

/**
 * Vérifie et consomme un jeton. Retourne `null` si le jeton est inconnu,
 * expiré, déjà utilisé, ou si le compte est désactivé.
 *
 * La consommation est atomique (`updateMany` conditionnel) : deux requêtes
 * concurrentes avec le même token ne peuvent pas réussir toutes les deux.
 */
export async function consumePasswordResetToken(
  token: string,
): Promise<ConsumedResetToken | null> {
  if (!token) return null;

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });

  if (!record) return null;
  if (record.usedAt) return null;
  if (record.expiresAt < new Date()) return null;
  if (!record.user.isActive) return null;

  const consumed = await prisma.passwordResetToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  if (consumed.count !== 1) return null; // déjà consommé entre-temps

  return {
    userId: record.user.id,
    email: record.user.email,
    username: record.user.username,
  };
}

/** Vérifie qu'un jeton est exploitable, sans le consommer (pré-affichage du formulaire). */
export async function isResetTokenUsable(token: string): Promise<boolean> {
  if (!token) return false;
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { usedAt: true, expiresAt: true, user: { select: { isActive: true } } },
  });
  if (!record) return false;
  return !record.usedAt && record.expiresAt > new Date() && record.user.isActive;
}
