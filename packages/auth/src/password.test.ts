import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, generateRefreshTokenString, hashRefreshToken } from './password.js';

describe('Password — argon2id', () => {
  it('hache et vérifie un mot de passe', async () => {
    const hash = await hashPassword('CorrectHorseBatteryStaple!');
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword('CorrectHorseBatteryStaple!', hash)).toBe(true);
    expect(await verifyPassword('mauvais', hash)).toBe(false);
  });

  it('refuse les mots de passe trop courts', async () => {
    await expect(hashPassword('123')).rejects.toThrow(/au moins 6/);
  });

  it('refuse une vérification avec hash vide', async () => {
    expect(await verifyPassword('whatever', '')).toBe(false);
  });
});

describe('Refresh token generator', () => {
  it('génère des tokens uniques', () => {
    const a = generateRefreshTokenString();
    const b = generateRefreshTokenString();
    expect(a.token).not.toBe(b.token);
    expect(a.hash).not.toBe(b.hash);
    expect(a.token).toHaveLength(64); // base64url(48 bytes)
    expect(a.hash).toHaveLength(64); // sha256 hex
  });

  it('hashRefreshToken est déterministe', () => {
    const { token, hash } = generateRefreshTokenString();
    expect(hashRefreshToken(token)).toBe(hash);
  });
});
