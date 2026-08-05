import { describe, it, expect } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  validatePassword,
  isPasswordStrong,
  PasswordPolicyError,
  generateSecureToken,
  generateRefreshTokenString,
  hashToken,
  hashRefreshToken,
} from './password';

const STRONG = 'CorrectHorse9!Battery';

describe('Password — argon2id', () => {
  it('hache et vérifie un mot de passe', async () => {
    const hash = await hashPassword(STRONG);
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(STRONG, hash)).toBe(true);
    expect(await verifyPassword('mauvais', hash)).toBe(false);
  });

  it('refuse une vérification avec hash vide', async () => {
    expect(await verifyPassword('whatever', '')).toBe(false);
  });
});

describe('Password — politique', () => {
  it('accepte un mot de passe conforme', () => {
    expect(validatePassword(STRONG)).toEqual([]);
    expect(isPasswordStrong(STRONG)).toBe(true);
  });

  it.each([
    ['Ab1!aaa', 'au moins 12 caractères'],
    ['abcdefghij1!', 'une majuscule'],
    ['ABCDEFGHIJ1!', 'une minuscule'],
    ['Abcdefghijk!', 'un chiffre'],
    ['Abcdefghijk1', 'un caractère spécial'],
  ])('rejette %s (manque : %s)', (pw, expected) => {
    expect(validatePassword(pw)).toContain(expected);
    expect(isPasswordStrong(pw)).toBe(false);
  });

  it('hashPassword refuse un mot de passe faible', async () => {
    await expect(hashPassword('123')).rejects.toBeInstanceOf(PasswordPolicyError);
    await expect(hashPassword('Admin123!')).rejects.toThrow(/12 caractères/);
  });
});

describe('Tokens opaques', () => {
  it('génère des tokens uniques', () => {
    const a = generateSecureToken();
    const b = generateSecureToken();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
    expect(a.token).toHaveLength(64); // base64url(48 bytes)
    expect(a.hash).toHaveLength(64); // sha256 hex
  });

  it('hashToken est déterministe', () => {
    const { token, hash } = generateSecureToken();
    expect(hashToken(token)).toBe(hash);
  });

  it('les alias historiques restent compatibles', () => {
    const { token, hash } = generateRefreshTokenString();
    expect(hashRefreshToken(token)).toBe(hash);
  });
});
