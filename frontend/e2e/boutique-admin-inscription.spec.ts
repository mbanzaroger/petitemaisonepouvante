import { expect, test } from '@playwright/test';
import { auditerAccessibilite, seConnecter } from './outils';

test.describe('Administration de la boutique et inscription (US18 à US20)', () => {
  test("l'administrateur ajoute un produit en stock ; un client le commande ; la commande apparaît chez l'administrateur", async ({
    browser,
    page,
  }, testInfo) => {
    const suffixe = Date.now().toString(36).toUpperCase();
    const nom = `Figurine Evil Ed de recette ${suffixe}`;

    await page.goto('/admin/produits/nouveau');
    await seConnecter(page, 'admin-pme');
    await expect(page.getByRole('heading', { level: 1, name: 'Nouveau produit' })).toBeVisible();
    await page.getByLabel(/^Nom/).fill(nom);
    await page.getByLabel(/^Référence unique/).fill(`E2E-${suffixe}`);
    await page.getByLabel('Catégorie').selectOption('Figurines');
    await page.getByLabel(/^Prix en euros/).fill('39,90');
    await page.getByLabel(/^Description/).fill('Produit créé par le test de bout en bout.');
    await page.getByLabel(/^Stock initial/).fill('3');
    await page.getByLabel(/^Exclusivité Evil Ed/).check();
    await auditerAccessibilite(page, testInfo, 'nouveau-produit');
    await page.getByRole('button', { name: 'Créer le produit' }).click();
    const confirmation = page.getByText(/Produit créé et mis en vente/);
    await expect(confirmation).toContainText('Stock initial : 3 unités.');
    const lienProduit = page.getByRole('link', { name: nom });
    const fiche = (await lienProduit.getAttribute('href')) ?? '';

    await page.getByRole('link', { name: 'Retour aux produits et au stock' }).click();
    await page.getByLabel(`Quantité à ajouter au stock de ${nom}`).fill('2');
    await page.getByRole('button', { name: `Ajouter au stock de ${nom}` }).click();
    await expect(page.getByText(`Stock de « ${nom} » : 5 disponibles.`)).toBeVisible();
    await auditerAccessibilite(page, testInfo, 'produits-et-stock');

    // Un client commande le nouveau produit, dans une autre session de navigateur.
    const client = await browser.newPage();
    await client.goto(fiche);
    await expect(client.getByRole('heading', { level: 1, name: nom })).toBeVisible();
    await client.getByRole('button', { name: 'Ajouter au panier' }).click();
    await client.getByRole('link', { name: 'Voir le panier' }).click();
    await seConnecter(client, 'carol', 'Se connecter pour commander');
    await client.getByRole('button', { name: 'Valider la commande' }).click();
    await expect(client.getByRole('status').filter({ hasText: 'Statut' })).toContainText('Confirmée', { timeout: 45_000 });
    await client.close();

    await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Commandes clients' }).click();
    await page.getByLabel('Statut').selectOption('CONFIRMED');
    const ligne = page.getByRole('row').filter({ hasText: nom });
    await expect(ligne).toContainText('carol');
    await expect(ligne).toContainText('Confirmée');
    await auditerAccessibilite(page, testInfo, 'commandes-clients');
  });

  test('un visiteur crée son compte client et peut commander aussitôt', async ({ page }, testInfo) => {
    const identifiant = `client-${Date.now().toString(36)}`;
    await page.goto('/panier');
    await page.getByRole('banner').getByRole('button', { name: 'Créer un compte' }).click();
    await page.waitForURL(/\/realms\/pme\/(protocol\/openid-connect\/registrations|login-actions\/registration)/);
    await expect(page.getByRole('heading', { level: 1, name: 'Créer votre compte client' })).toBeVisible();
    await auditerAccessibilite(page, testInfo, 'inscription');
    await page.locator('#username').fill(identifiant);
    await page.locator('#email').fill(`${identifiant}@exemple.test`);
    await page.locator('#firstName').fill('Nouveau');
    await page.locator('#lastName').fill('Client');
    await page.locator('#password').fill('mot-de-passe-de-recette-1');
    await page.locator('#password-confirm').fill('mot-de-passe-de-recette-1');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();

    await expect(page.getByRole('banner').getByText(identifiant, { exact: true })).toBeVisible();
    await expect(page.getByRole('banner')).toContainText('Client');
    await expect(page).toHaveURL(/\/panier$/);
    await page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Mes commandes' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Mes commandes' })).toBeVisible();
  });
});
