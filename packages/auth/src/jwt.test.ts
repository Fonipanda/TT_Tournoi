import { describe, it, expect, beforeAll } from 'vitest';
import {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  isJwtExpired,
  isJwtInvalid,
} from './jwt.js';

beforeAll(() => {
  process.env.JWT_ACCESS_SECRET =
    'test-access-secret-must-be-32-chars-minimum-aaa';
  process.env.JWT_REFRESH_SECRET =
    'test-refresh-secret-must-be-32-chars-minimum-bb';
});

describe('JWT — access token', () => {
  it('signe et vérifie un access token valide', async () => {
    const token = await signAccessToken({
      sub: 'user-1',
      role: 'admin',
      username: 'admin',
    });
    expect(typeof token).toBe('string');
    const claims = await verifyAccessToken(token);
    expect(claims.sub).toBe('user-1');
    expect(claims.role).toBe('admin');
    expect(claims.username).toBe('admin');
  });

  it('rejette un token avec le mauvais secret', async () => {
    const token = await signAccessToken({ sub: 'u1', role: 'player' });
    process.env.JWT_ACCESS_SECRET =
      'autre-secret-changement-32-chars-minimum-zzzz';
    let caught: unknown;
    try {
      await verifyAccessToken(token);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(isJwtInvalid(caught) || isJwtExpired(caught)).toBe(true);
    // restaurer
    process.env.JWT_ACCESS_SECRET =
      'test-access-secret-must-be-32-chars-minimum-aaa';
  });

  it('rejette un token expiré', async () => {
    const token = await signAccessToken({ sub: 'u1', role: 'player' }, '1s');
    await new Promise((r) => setTimeout(r, 1100));
    let caught: unknown;
    try {
      await verifyAccessToken(token);
    } catch (e) {
      caught = e;
    }
    expect(isJwtExpired(caught)).toBe(true);
  });
});

describe('JWT — refresh token', () => {
  it('inclut un jti et permet la révocation', async () => {
    const jti = 'refresh-id-1';
    const token = await signRefreshToken({ sub: 'u1', jti });
    const claims = await verifyRefreshToken(token);
    expect(claims.sub).toBe('u1');
    expect(claims.jti).toBe(jti);
  });

  it('un access token ne passe pas la vérification refresh (audience)', async () => {
    const accessToken = await signAccessToken({ sub: 'u1', role: 'admin' });
    let caught: unknown;
    try {
      await verifyRefreshToken(accessToken);
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeDefined();
    expect(isJwtInvalid(caught)).toBe(true);
  });
});

describe('JWT — secret length', () => {
  it('refuse un secret trop court', async () => {
    process.env.JWT_ACCESS_SECRET = 'too-short';
    let caught: unknown;
    try {
      await signAccessToken({ sub: 'u1', role: 'player' });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(Error);
    process.env.JWT_ACCESS_SECRET =
      'test-access-secret-must-be-32-chars-minimum-aaa';
  });
});
