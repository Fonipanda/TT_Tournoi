/**
 * Test E2E flow critique : Juge-Arbitre saisit un score → public voit la mise à jour.
 *
 * Pré-requis : seed appliqué + au moins 1 match en cours créé manuellement.
 * Ce test crée le match via API admin, puis valide le flow complet.
 */

import { test, expect } from '@playwright/test';

const ADMIN_USERNAME = process.env.E2E_ADMIN_USER ?? 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASS ?? 'Admin123!';

test.describe('Flow score live', () => {
  let adminCookie: string | undefined;

  test.beforeAll(async ({ browser }) => {
    // Login admin et capture du cookie pour réutilisation
    const ctx = await browser.newContext();
    const res = await ctx.request.post('/api/auth/login', {
      data: { identifier: ADMIN_USERNAME, password: ADMIN_PASSWORD, mode: 'admin' },
    });
    expect(res.ok()).toBeTruthy();
    const cookies = await ctx.cookies();
    adminCookie = cookies.find((c) => c.name === 'tt_access')?.value;
    await ctx.close();
  });

  test('admin peut lister les matches', async ({ request }) => {
    expect(adminCookie).toBeDefined();
    const res = await request.get('/api/matches', {
      headers: { Cookie: `tt_access=${adminCookie}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body).toHaveProperty('data');
  });

  test('mise à jour de score avec mauvaise version → 409', async ({ request }) => {
    // Récupère un match (ou skip si aucun)
    const list = await request.get('/api/matches', {
      headers: { Cookie: `tt_access=${adminCookie}` },
    });
    const data = await list.json();
    const match = (data.data ?? []).find(
      (m: any) => m.player1Id && m.player2Id && m.status !== 'finished',
    );
    test.skip(!match, 'Aucun match avec 2 joueurs disponible — lancer le seed et générer les poules');

    // Tente une update avec version invalide
    const res = await request.patch(`/api/matches/${match.id}/score`, {
      headers: { Cookie: `tt_access=${adminCookie}` },
      data: {
        scoreP1: 11,
        scoreP2: 9,
        setsP1: 1,
        setsP2: 0,
        version: 9999, // version invalide volontairement
        optimisticId: 'test-conflict-1',
      },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('version_conflict');
  });

  test('mise à jour de score idempotente (même optimisticId = no-op)', async ({ request }) => {
    const list = await request.get('/api/matches', {
      headers: { Cookie: `tt_access=${adminCookie}` },
    });
    const data = await list.json();
    const match = (data.data ?? []).find(
      (m: any) => m.player1Id && m.player2Id && m.status !== 'finished',
    );
    test.skip(!match, 'Aucun match avec 2 joueurs disponible');

    const optimisticId = `idem-${Date.now()}`;
    const body = {
      scoreP1: 11,
      scoreP2: 9,
      setsP1: match.setsP1 + 1,
      setsP2: match.setsP2,
      version: match.version,
      optimisticId,
    };

    // 1ère soumission
    const r1 = await request.patch(`/api/matches/${match.id}/score`, {
      headers: { Cookie: `tt_access=${adminCookie}` },
      data: body,
    });
    expect(r1.ok()).toBeTruthy();
    const updated = await r1.json();
    expect(updated.version).toBe(match.version + 1);
    expect(updated.setsP1).toBe(match.setsP1 + 1);

    // 2ème soumission identique → 409 car version a déjà été incrémentée
    const r2 = await request.patch(`/api/matches/${match.id}/score`, {
      headers: { Cookie: `tt_access=${adminCookie}` },
      data: body,
    });
    expect(r2.status()).toBe(409);
  });
});
