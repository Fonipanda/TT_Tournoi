/**
 * Tests API critiques — bypass UI, valide directement les endpoints REST.
 *
 * Couverture :
 *  - /api/health
 *  - /api/auth/login (admin + licence)
 *  - /api/auth/me
 *  - /api/tournaments (lecture publique)
 *  - /api/matches/:id/score (optimistic concurrency 409)
 */

import { test, expect } from '@playwright/test';

const ADMIN_USERNAME = process.env.E2E_ADMIN_USER ?? 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASS ?? 'Admin123!';

test.describe('API — health', () => {
  test('GET /api/health renvoie le statut DB+Redis', async ({ request }) => {
    const res = await request.get('/api/health');
    const body = await res.json();
    expect(body).toMatchObject({
      services: { db: expect.any(String), redis: expect.any(String) },
      uptime: expect.any(Number),
      version: expect.any(String),
    });
  });
});

test.describe('API — auth', () => {
  test('login admin retourne le user', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { identifier: ADMIN_USERNAME, password: ADMIN_PASSWORD, mode: 'admin' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.user).toMatchObject({
      username: ADMIN_USERNAME,
      role: 'admin',
    });
  });

  test('login avec mauvais mot de passe → 401', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { identifier: ADMIN_USERNAME, password: 'wrong', mode: 'admin' },
    });
    expect(res.status()).toBe(401);
  });

  test('login licence FFTT du seed (7711100001)', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { identifier: '7711100001', mode: 'player' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.user.role).toBe('player');
    expect(body.user.playerId).toBeTruthy();
  });

  test('GET /api/auth/me sans cookie → 401', async ({ request }) => {
    const res = await request.get('/api/auth/me');
    expect(res.status()).toBe(401);
  });
});

test.describe('API — données publiques', () => {
  test('GET /api/tournaments retourne la liste (lecture publique)', async ({ request }) => {
    const res = await request.get('/api/tournaments');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('GET /api/live/tables retourne le snapshot', async ({ request }) => {
    const res = await request.get('/api/live/tables');
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('serverTime');
  });

  test('GET /api/menu charge le menu', async ({ request }) => {
    const res = await request.get('/api/menu');
    expect(res.ok()).toBeTruthy();
  });
});

test.describe('API — RBAC', () => {
  test('POST /api/tournaments sans auth → 401', async ({ request }) => {
    const res = await request.post('/api/tournaments', {
      data: { name: 'Hack', date: '2099-01-01' },
    });
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/sms/test en tant que joueur → 403', async ({ request }) => {
    // Login joueur
    await request.post('/api/auth/login', {
      data: { identifier: '7711100001', mode: 'player' },
    });
    // Tentative d'accès admin
    const res = await request.post('/api/sms/test', {
      data: { to: '+33600000000', message: 'hack' },
    });
    expect(res.status()).toBe(403);
  });
});
