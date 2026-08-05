/**
 * Politique de mot de passe — module PUR (aucune dépendance native).
 *
 * Volontairement séparé de `password.ts` (qui importe argon2, natif Node.js)
 * afin de pouvoir être importé depuis un composant client React.
 */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/** Message unique, réutilisé côté API et côté formulaires. */
export const PASSWORD_POLICY_MESSAGE =
  'Le mot de passe doit contenir au moins 12 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial.';

export class PasswordPolicyError extends Error {
  constructor(message = PASSWORD_POLICY_MESSAGE) {
    super(message);
    this.name = 'PasswordPolicyError';
  }
}

export interface PasswordRule {
  id: 'length' | 'uppercase' | 'lowercase' | 'digit' | 'special';
  label: string;
  test: (password: string) => boolean;
}

/** Règles affichables sous forme de checklist dans les formulaires. */
export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: 'length',
    label: `Au moins ${PASSWORD_MIN_LENGTH} caractères`,
    test: (pw) => pw.length >= PASSWORD_MIN_LENGTH && pw.length <= PASSWORD_MAX_LENGTH,
  },
  { id: 'uppercase', label: 'Une majuscule', test: (pw) => /[A-Z]/.test(pw) },
  { id: 'lowercase', label: 'Une minuscule', test: (pw) => /[a-z]/.test(pw) },
  { id: 'digit', label: 'Un chiffre', test: (pw) => /[0-9]/.test(pw) },
  {
    id: 'special',
    label: 'Un caractère spécial',
    test: (pw) => /[^A-Za-z0-9]/.test(pw),
  },
] as const;

/**
 * Valide un mot de passe contre la politique.
 * Retourne la liste des règles non respectées (tableau vide si conforme).
 */
export function validatePassword(password: string): string[] {
  const pw = password ?? '';
  const errors: string[] = [];
  if (pw.length < PASSWORD_MIN_LENGTH) {
    errors.push(`au moins ${PASSWORD_MIN_LENGTH} caractères`);
  }
  if (pw.length > PASSWORD_MAX_LENGTH) {
    errors.push(`au maximum ${PASSWORD_MAX_LENGTH} caractères`);
  }
  if (!/[A-Z]/.test(pw)) errors.push('une majuscule');
  if (!/[a-z]/.test(pw)) errors.push('une minuscule');
  if (!/[0-9]/.test(pw)) errors.push('un chiffre');
  if (!/[^A-Za-z0-9]/.test(pw)) errors.push('un caractère spécial');
  return errors;
}

export function isPasswordStrong(password: string): boolean {
  return validatePassword(password).length === 0;
}

/** Lance une `PasswordPolicyError` si le mot de passe est trop faible. */
export function assertPasswordPolicy(password: string): void {
  if (!isPasswordStrong(password)) {
    throw new PasswordPolicyError();
  }
}
