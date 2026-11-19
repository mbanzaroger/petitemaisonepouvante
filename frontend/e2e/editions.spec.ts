import { expect, test } from '@playwright/test';
import { auditerAccessibilite, seConnecter } from './outils';

test.describe('Éditions : actualités, fanzine numérique, abonnement (US15 à US17)', () => {
  test("un visiteur lit les actualités et l'extrait d'un numéro ; la suite lui est réservée", async ({
    page,
  }, testInfo) => {
    await page.goto('/actualites');
    await expect(page.getByRole('heading', { level: 1, name: 'Actualités et articles' })).toBeVisible();
    await auditerAccessibilite(page, testInfo, 'actualites');
    await page.getByRole('link', { name: 'Articles de fond' }).click();
    await page.getByRole('link', { name: /couleurs du giallo/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: /couleurs du giallo/ })).toBeVisible();
    await auditerAccessibilite(page, testInfo, 'article');

    await page.goto('/fanzine');
    await page.getByRole('link', { name: "Lire l'extrait du numéro 36" }).click();
    await expect(page.getByRole('heading', { level: 2, name: /Page 1 sur 4 : Édito/ })).toBeVisible();
    await auditerAccessibilite(page, testInfo, 'liseuse-extrait');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByText(/réservée aux lecteurs qui l'ont acheté ou qui sont abonnés/)).toBeVisible();
  });

  test('un membre achète un numéro, le lit dans la liseuse et le retrouve dans sa bibliothèque', async ({
    page,
  }, testInfo) => {
    await page.goto('/fanzine');
    await seConnecter(page, 'carol', "Se connecter pour acheter ou s'abonner");
    const acheter = page.getByRole('button', { name: /Acheter le numéro 36/ });
    const lire = page.getByRole('link', { name: 'Lire le numéro 36' });
    await expect(acheter.or(lire)).toBeVisible();
    if (await acheter.isVisible()) {
      await acheter.click();
      await expect(page.getByText(/Numéro ajouté à votre bibliothèque/)).toBeVisible();
    } else {
      await lire.click();
      await page.getByRole('button', { name: 'Page suivante' }).click();
    }
    await expect(page.getByRole('heading', { level: 2, name: /Page 2 sur 4 : Dossier/ })).toBeVisible();
    await page.getByRole('button', { name: 'Page suivante' }).click();
    await expect(page.getByRole('heading', { level: 2, name: /Page 3 sur 4/ })).toBeFocused();
    await auditerAccessibilite(page, testInfo, 'liseuse');

    await page.goto('/mon-espace');
    await expect(
      page.getByRole('link', {
        name: /reprendre la lecture \(page 3\) le numéro 36/,
      }),
    ).toBeVisible();
  });

  test("un membre s'abonne au fanzine numérique ou consulte son abonnement en cours", async ({ page }, testInfo) => {
    await page.goto('/fanzine/abonnement');
    await seConnecter(page, 'alice');
    await expect(page.getByRole('heading', { level: 1, name: 'Abonnement au fanzine' })).toBeVisible();
    const pasAbonne = page.getByText("Vous n'êtes pas abonné.");
    await expect(pasAbonne.or(page.getByText('En cours', { exact: true }))).toBeVisible();
    if (await pasAbonne.isVisible()) {
      await page.getByLabel(/Numérique : /).check();
      await page.getByRole('button', { name: "S'abonner" }).click();
      await expect(page.getByText(/Abonnement souscrit/)).toBeVisible();
    }
    await expect(page.getByText('En cours', { exact: true })).toBeVisible();
    await auditerAccessibilite(page, testInfo, 'abonnement');
  });

  test('la rédaction publie une actualité, lisible aussitôt par tous', async ({ page }, testInfo) => {
    const titre = `Actualité e2e ${Date.now()}`;
    await page.goto('/admin/redaction');
    await seConnecter(page, 'admin-pme');
    await page.getByLabel(/Titre/).fill(titre);
    await page.getByLabel(/Résumé/).fill('Résumé publié par le test de bout en bout.');
    await page.getByLabel(/Texte/).fill('Premier paragraphe.\n\nSecond paragraphe de l’actualité.');
    await page.getByRole('button', { name: 'Publier' }).click();
    await page.getByRole('link', { name: titre }).click();
    await expect(page.getByRole('heading', { level: 1, name: titre })).toBeVisible();
    await auditerAccessibilite(page, testInfo, 'redaction-article');
  });
});
