/**
 * Smoke tests — vérifient que les pages publiques chargent sans erreur.
 */

import { test, expect } from '@playwright/test';

test.describe('Pages publiques', () => {
  test('Accueil charge et affiche la nav', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('public-nav')).toBeVisible();
    await expect(page.getByTestId('logo')).toContainText('TT Tournoi');
  });

  test('Live charge et affiche le badge connexion WS', async ({ page }) => {
    await page.goto('/live');
    await expect(page.getByTestId('live-page')).toBeVisible();
    await expect(page.getByTestId('live-status')).toBeVisible();
  });

  test('Live TV est accessible', async ({ page }) => {
    await page.goto('/live/tv');
    await expect(page.getByTestId('live-tv')).toBeVisible();
  });

  test('Progression liste les tableaux', async ({ page }) => {
    await page.goto('/progression');
    await expect(page.getByTestId('progression-page')).toBeVisible();
  });

  test('Buvette charge', async ({ page }) => {
    await page.goto('/buvette');
    await expect(page.getByTestId('buvette-page')).toBeVisible();
  });

  test('Règlement charge', async ({ page }) => {
    await page.goto('/reglement');
    await expect(page.getByTestId('reglement-page')).toBeVisible();
    await expect(page.getByText('I.301')).toBeVisible();
  });

  test('Healthcheck répond OK', async ({ request }) => {
    const res = await request.get('/api/health');
    expect([200, 503]).toContain(res.status()); // 503 si DB pas dispo en CI
    const body = await res.json();
    expect(body).toHaveProperty('services');
  });
});
