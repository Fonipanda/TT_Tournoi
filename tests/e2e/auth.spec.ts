/**
 * Auth flow E2E — login admin, accès dashboard, logout, mot de passe oublié.
 *
 * Dépend du seed : compte 'admin' / 'Admin123!'.
 * Si le password a déjà été reset, mettre la valeur réelle dans E2E_ADMIN_PASS.
 *
 * Les routes d'auth sont rate-limitées : lancer le serveur de test avec
 * RATE_LIMIT_DISABLED=true pour éviter les faux négatifs en cas de retry.
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

  test('la session survit à la navigation et le bouton devient « Se déconnecter »', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByTestId('mode-admin').click();
    await page.getByTestId('identifier').fill(ADMIN_USERNAME);
    await page.getByTestId('password').fill(ADMIN_PASSWORD);
    await page.getByTestId('submit').click();
    await page.waitForURL((url) => !url.pathname.startsWith('/login'));

    // La session doit rester active quelle que soit la navigation :
    // seul un clic sur « Se déconnecter » doit y mettre fin.
    for (const path of ['/', '/live', '/progression', '/buvette', '/']) {
      await page.goto(path);
      await expect(page.getByTestId('logout-button')).toBeVisible();
      await expect(page.getByTestId('login-link')).toHaveCount(0);
    }

    await page.getByTestId('logout-button').click();
    await expect(page.getByTestId('login-link')).toBeVisible();
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

test.describe('Auth — mot de passe oublié', () => {
  test('le lien est présent sur la page de connexion', async ({ page }) => {
    await page.goto('/login');
    await page.getByTestId('forgot-password-link').click();
    await expect(page).toHaveURL(/\/mot-de-passe-oublie/);
  });

  test('la demande renvoie toujours une confirmation neutre', async ({ page }) => {
    await page.goto('/mot-de-passe-oublie');
    await page.getByTestId('email').fill('inexistant@exemple.fr');
    await page.getByTestId('submit-forgot').click();
    // Même réponse que le compte existe ou non (anti-énumération)
    await expect(page.getByTestId('forgot-sent')).toBeVisible();
  });

  test('un token invalide affiche un message explicite', async ({ page }) => {
    await page.goto('/reinitialiser-mot-de-passe?token=token-bidon-qui-nexiste-pas');
    await expect(page.getByTestId('reset-invalid')).toBeVisible();
  });
});

test.describe('Auth — politique de mot de passe', () => {
  test("l'inscription refuse un mot de passe trop faible", async ({ page }) => {
    await page.goto('/register');
    await page.getByTestId('password').fill('faible1');

    // La checklist signale les règles non respectées
    await expect(page.getByTestId('rule-length')).toHaveAttribute('data-ok', 'false');
    await expect(page.getByTestId('rule-uppercase')).toHaveAttribute('data-ok', 'false');
    await expect(page.getByTestId('rule-special')).toHaveAttribute('data-ok', 'false');

    // Le bouton reste désactivé
    await expect(page.getByTestId('submit-register')).toBeDisabled();
  });

  test('un mot de passe conforme valide toutes les règles', async ({ page }) => {
    await page.goto('/register');
    await page.getByTestId('password').fill('CorrectHorse9!Battery');

    for (const rule of ['length', 'uppercase', 'lowercase', 'digit', 'special']) {
      await expect(page.getByTestId(`rule-${rule}`)).toHaveAttribute('data-ok', 'true');
    }
  });
});
