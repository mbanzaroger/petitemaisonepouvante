import { expect, test } from '@playwright/test';
import { auditerAccessibilite, ouvrirConnexion, seConnecter } from './outils';

test.describe('Espace administrateur', () => {
  test('un administrateur consulte le stock en direct', async ({ page }, testInfo) => {
    await page.goto('/');
    await seConnecter(page, 'admin-pme');
    const navigation = page.getByRole('navigation', { name: 'Navigation principale' });
    await expect(navigation.getByRole('link', { name: 'Mes commandes' })).toHaveCount(0);
    await navigation.getByRole('link', { name: 'Stock' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Stock' })).toBeFocused();
    const tableau = page.getByRole('table', { name: /Stock des produits du catalogue/ });
    await expect(tableau.getByRole('row')).not.toHaveCount(1);
    await expect(tableau).toContainText(/Correct|Stock bas|Épuisé|Non suivi/);
    await auditerAccessibilite(page, testInfo, 'stock');
    await page.getByLabel(/N'afficher que les produits à surveiller/).check();
    await expect(page.getByRole('status').filter({ hasText: 'à surveiller' })).toBeVisible();
  });

  test('un client est refusé sur la page de stock', async ({ page }) => {
    await page.goto('/admin/stock');
    await seConnecter(page, 'alice');
    await expect(page.getByRole('heading', { level: 1, name: 'Accès refusé' })).toBeVisible();
  });
});

test.describe('Pages d’information et connexion (RGAA, RGPD)', () => {
  test('pages légales accessibles depuis le pied de page, sans violation axe', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'Catalogue' })).toBeVisible();
    const pied = page.getByRole('navigation', { name: 'Informations sur le site' });
    for (const [lien, titre, nom] of [
      ['Plan du site', 'Plan du site', 'plan-du-site'],
      ['Accessibilité : non conforme', "Déclaration d'accessibilité", 'accessibilite'],
      ['Mentions légales', 'Mentions légales', 'mentions-legales'],
      ['Données personnelles et cookies', 'Données personnelles et cookies', 'donnees-personnelles'],
    ] as const) {
      await pied.getByRole('link', { name: lien }).click();
      await expect(page.getByRole('heading', { level: 1, name: titre })).toBeFocused();
      await auditerAccessibilite(page, testInfo, nom);
    }
  });

  test('la page de connexion Keycloak porte le thème du site et reste accessible', async ({ page }, testInfo) => {
    await page.goto('/');
    await ouvrirConnexion(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('#kc-header-wrapper')).toHaveText("La Petite Maison de l'Épouvante");
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Connexion à votre compte client');
    await auditerAccessibilite(page, testInfo, 'connexion-keycloak');
  });
});
