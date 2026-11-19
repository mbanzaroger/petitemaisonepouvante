import { expect, test } from '@playwright/test';
import { auditerAccessibilite, motDePasse, seConnecter } from './outils';

test.describe('Sécurité du site', () => {
  test('en-têtes de sécurité et CSP stricte sur la page servie', async ({ request }) => {
    const reponse = await request.get('/');
    expect(reponse.status()).toBe(200);
    const entetes = reponse.headers();
    const csp = entetes['content-security-policy'] ?? '';
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
    expect(entetes['strict-transport-security']).toContain('max-age=31536000');
    expect(entetes['x-content-type-options']).toBe('nosniff');
    expect(entetes['x-frame-options']).toBe('DENY');
    expect(entetes['referrer-policy']).toBe('no-referrer');
  });

  test("aucun jeton n'est conservé dans le stockage du navigateur", async ({ page }) => {
    await page.goto('/commandes');
    await expect(page.getByRole('heading', { level: 1, name: 'Connexion requise' })).toBeVisible();
    await seConnecter(page, 'alice');
    await expect(page.getByRole('heading', { level: 1, name: 'Mes commandes' })).toBeVisible();
    const stockage = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
    expect(stockage).not.toMatch(/eyJ[\w-]+\.[\w-]+/);
  });

  test('un compte sans rôle client ne peut ni commander ni consulter de commandes', async ({ page }) => {
    await page.goto('/commandes');
    await seConnecter(page, 'bob');
    await expect(page.getByRole('heading', { level: 1, name: 'Accès refusé' })).toBeVisible();
    // Pas d'authentification « ambiante » : sans jeton explicite (aucun cookie vers l'API), le Gateway répond 401.
    // Une page tierce ne peut donc pas déclencher de commande au nom de l'utilisateur (CSRF).
    const statut = await page.evaluate(async () => (await fetch('/api/v1/orders', { credentials: 'include' })).status);
    expect(statut).toBe(401);
  });

  test('un compte refusé change de compte sans rester bloqué par sa session', async ({ page }) => {
    await page.goto('/commandes');
    await seConnecter(page, 'bob');
    await expect(page.getByText(/Vous êtes connecté avec le compte « bob »/)).toBeVisible();
    // La session bob est fermée puis le formulaire s'ouvre directement : sans cela, Keycloak reconnecterait bob.
    await page.getByRole('main').getByRole('button', { name: 'Changer de compte' }).click();
    await page.waitForURL(/\/realms\/pme\/(protocol\/openid-connect\/auth|login-actions)/);
    await page.locator('#username').fill('alice');
    await page.locator('#password').fill(motDePasse('alice'));
    await page.locator('#kc-login').click();
    await expect(page.getByRole('heading', { level: 1, name: 'Mes commandes' })).toBeVisible();
    await expect(page.getByRole('banner').getByText('alice', { exact: true })).toBeVisible();
    await expect(page).not.toHaveURL(/connexion=/);
  });
});

test.describe('Accessibilité (RGAA 4.1, contrôles automatisables)', () => {
  test('lien d’évitement, focus visible et pages sans violation axe', async ({ page }, testInfo) => {
    await page.goto('/');
    // La SPA lit config.json avant son premier rendu : attendre la page avant de tabuler.
    await expect(page.getByRole('heading', { level: 1, name: 'Catalogue' })).toBeVisible();
    await page.keyboard.press('Tab');
    const evitement = page.getByRole('link', { name: 'Aller au contenu' });
    await expect(evitement).toBeFocused();
    await expect(evitement).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#contenu$/);

    await page.goto('/panier');
    await expect(page.getByText('Votre panier est vide.')).toBeVisible();
    await auditerAccessibilite(page, testInfo, 'panier-vide');

    await page.goto('/commandes');
    await expect(page.getByRole('heading', { level: 1, name: 'Connexion requise' })).toBeVisible();
    await auditerAccessibilite(page, testInfo, 'connexion-requise');

    await page.goto('/adresse-inconnue');
    await expect(page.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeVisible();
    await auditerAccessibilite(page, testInfo, 'page-introuvable');
  });
});
