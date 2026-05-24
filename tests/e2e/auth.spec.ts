/**
 * Auth flow E2E — login admin, accès dashboard, logout.
 *
 * Dépend du seed : compte 'admin' / 'Admin123!' (passwordNeedsReset=true).
 * Si le password a déjà été reset, mettre la valeur réelle dans E2E_ADMIN_PASS.
 */

import { test, expect } from '@playwright/test';

const ADMIN_USERNAME = process.env.E2E_ADMIN_USER ?? 'admin';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASS ?? 'Admin123!';

test.describe('Auth — admin', () => {
  test('redirige vers /login depuis /admin si non auth', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });

  test('login admin → accès dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('mode-admin').click();
    await page.getByTestId('identifier').fill(ADMIN_USERNAME);
    await page.getByTestId('password').fill(ADMIN_PASSWORD);
    await page.getByTestId('submit').click();

    // Attente du redirect post-login (vers / par défaut)
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10_000 });

    // Maintenant on doit pouvoir accéder à /admin
    await page.goto('/admin');
    await expect(page.getByTestId('admin-dashboard')).toBeVisible();
    await expect(page.getByTestId('staff-sidebar')).toBeVisible();
  });

  test('mauvais mot de passe → erreur', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('mode-admin').click();
    await page.getByTestId('identifier').fill(ADMIN_USERNAME);
    await page.getByTestId('password').fill('wrong-password');
    await page.getByTestId('submit').click();
    await expect(page.getByTestId('login-error')).toBeVisible();
  });

  test('logout supprime les cookies', async ({ page, context }) => {
    // Login d'abord
    await page.goto('/login');
    await page.getByTestId('mode-admin').click();
    await page.getByTestId('identifier').fill(ADMIN_USERNAME);
    await page.getByTestId('password').fill(ADMIN_PASSWORD);
    await page.getByTestId('submit').click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'));

    // Vérifier que le cookie tt_access existe
    const cookiesBefore = await context.cookies();
    expect(cookiesBefore.find((c) => c.name === 'tt_access')).toBeDefined();

    // Logout via l'API directe
    await page.request.post('/api/auth/logout');

    // Vérifier que les cookies sont supprimés
    const cookiesAfter = await context.cookies();
    expect(cookiesAfter.find((c) => c.name === 'tt_access')).toBeUndefined();
  });
});
