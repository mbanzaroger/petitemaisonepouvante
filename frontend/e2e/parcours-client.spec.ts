import { expect, test } from '@playwright/test';
import { BUSTE, MUG, auditerAccessibilite, seConnecter } from './outils';

test.describe('Parcours client (US1 à US4 dans le navigateur)', () => {
  test('consulter, commander, suivre la confirmation et retrouver la commande', async ({ page }, testInfo) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/^Catalogue – La Petite Maison de l'Épouvante$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Catalogue' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeVisible();
    await auditerAccessibilite(page, testInfo, 'catalogue');

    await page.getByLabel('Catégorie').selectOption('Goodies');
    await page.getByRole('button', { name: 'Filtrer' }).click();
    await expect(page).toHaveURL(/categorie=Goodies/);
    await page.getByRole('link', { name: MUG.nom }).click();
    await expect(page.getByRole('heading', { level: 1, name: MUG.nom })).toBeFocused();
    await auditerAccessibilite(page, testInfo, 'fiche-produit');

    await page.getByLabel('Quantité').selectOption('2');
    await page.getByRole('button', { name: 'Ajouter au panier' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'ajouté au panier' })).toBeVisible();
    await page.getByRole('link', { name: 'Voir le panier' }).click();
    await expect(page.getByRole('rowheader', { name: MUG.nom })).toBeVisible();
    await auditerAccessibilite(page, testInfo, 'panier-visiteur');

    // Le panier survit à l'aller-retour vers Keycloak (stockage de session, sans donnée personnelle).
    await seConnecter(page, 'alice', 'Se connecter pour commander');
    await expect(page).toHaveURL(/\/panier$/);
    await expect(page.getByRole('rowheader', { name: MUG.nom })).toBeVisible();

    await page.getByRole('button', { name: 'Valider la commande' }).click();
    await expect(page).toHaveURL(/\/commandes\/[0-9a-f-]{36}$/);
    await expect(page.getByText('Merci ! Votre commande a bien été enregistrée.')).toBeVisible();
    await expect(page.getByRole('status').filter({ hasText: 'Statut' })).toContainText('Confirmée', { timeout: 45_000 });
    const numero = (await page.getByRole('heading', { level: 1 }).textContent())?.replace('Commande n° ', '') ?? '';
    await auditerAccessibilite(page, testInfo, 'suivi-commande');

    await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Mes commandes' }).click();
    const historique = page.getByRole('table', { name: /Historique de mes commandes/ });
    await expect(historique.getByRole('link', { name: `Commande n° ${numero}` })).toBeVisible();
    await auditerAccessibilite(page, testInfo, 'historique');

    await page.getByRole('button', { name: 'Se déconnecter' }).click();
    await expect(page.getByRole('button', { name: 'Se connecter', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Mes commandes' })).toHaveCount(0);
  });

  test('une commande au-delà du stock est annulée et expliquée', async ({ page }) => {
    await page.goto(`/produits/${BUSTE.id}`);
    await expect(page.getByRole('heading', { level: 1, name: BUSTE.nom })).toBeVisible();
    await page.getByLabel('Quantité').selectOption('10');
    await page.getByRole('button', { name: 'Ajouter au panier' }).click();
    await page.getByRole('link', { name: 'Voir le panier' }).click();
    await seConnecter(page, 'alice', 'Se connecter pour commander');
    await page.getByRole('button', { name: 'Valider la commande' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Statut' })).toContainText('Annulée', { timeout: 45_000 });
    await expect(page.getByText(/rien ne vous sera facturé/)).toBeVisible();
  });
});
