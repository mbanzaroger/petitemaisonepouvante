import { expect, test, type Browser } from '@playwright/test';
import { auditerAccessibilite, seConnecter, type Utilisateur } from './outils';

/** Ouvre une session d'un autre membre dans un contexte de navigation séparé (cookies distincts). */
async function autreMembre(browser: Browser, baseURL: string | undefined, utilisateur: Utilisateur, chemin: string) {
  const contexte = await browser.newContext({ baseURL, ignoreHTTPSErrors: true, locale: 'fr-FR', timezoneId: 'Europe/Paris' });
  const page = await contexte.newPage();
  await page.goto(chemin);
  await seConnecter(page, utilisateur);
  return page;
}

test.describe('Espace communautaire (US8 à US12)', () => {
  test('troc complet : publication, proposition, acceptation, conversation privée et notifications', async ({
    page,
    browser,
    baseURL,
  }, testInfo) => {
    const titre = `Figurine e2e ${Date.now()}`;
    await page.goto('/communaute');
    await expect(page.getByRole('heading', { level: 1, name: 'Troc et dons' })).toBeVisible();
    await expect(page.getByText(/\d+ annonces?/)).toBeVisible();
    await seConnecter(page, 'alice', 'Se connecter pour publier');
    await auditerAccessibilite(page, testInfo, 'troc');

    await page.getByRole('link', { name: 'Publier une annonce' }).click();
    await page.getByLabel(/Titre/).fill(titre);
    await page.getByLabel(/Description/).fill('Figurine en parfait état, avec sa boîte, publiée par le test de bout en bout.');
    await page.getByLabel('Catégorie').selectOption('FIGURINES');
    await page.getByLabel("État de l'objet").selectOption('LIKE_NEW');
    await page.getByLabel(/Ce que vous recherchez/).fill('Un Blu-ray collector');
    await auditerAccessibilite(page, testInfo, 'publier-annonce');
    await page.getByRole('button', { name: "Publier l'annonce" }).click();
    await expect(page.getByRole('heading', { level: 1, name: titre })).toBeVisible();
    await expect(page.getByText(/Votre annonce est publiée/)).toBeVisible();
    const adresseAnnonce = new URL(page.url()).pathname;

    const carol = await autreMembre(browser, baseURL, 'carol', adresseAnnonce);
    await carol.getByLabel(/Votre message à alice/).fill('Je vous propose mon Blu-ray de « Suspiria ».');
    await auditerAccessibilite(carol, testInfo, 'annonce-proposition');
    await carol.getByRole('button', { name: 'Envoyer la proposition' }).click();
    await expect(carol.getByRole('heading', { level: 1, name: `Proposition pour « ${titre} »` })).toBeVisible();
    await expect(carol.getByRole('log').getByText('Je vous propose mon Blu-ray')).toBeVisible();

    await page.goto('/mon-espace');
    const notification = page.getByRole('link', { name: new RegExp(`carol vous propose un échange pour « ${titre} »`) });
    await expect(notification).toBeVisible();
    await expect(page.getByRole('banner').getByRole('link', { name: /Mon espace.*non lue/ })).toBeVisible();
    await auditerAccessibilite(page, testInfo, 'mon-espace');
    await notification.click();
    await page.getByRole('button', { name: 'Accepter la proposition' }).click();
    await expect(page.getByText(/Proposition acceptée : l'annonce est conclue/)).toBeVisible();
    await page.getByLabel('Votre message').fill('Avec plaisir ! Samedi à la boutique ?');
    await page.getByRole('button', { name: 'Envoyer', exact: true }).click();
    await expect(page.getByRole('log').getByText('Avec plaisir !')).toBeVisible();
    await auditerAccessibilite(page, testInfo, 'proposition');

    // La conversation est relevée périodiquement : carol voit la réponse sans recharger la page.
    await expect(carol.getByRole('log').getByText('Avec plaisir !')).toBeVisible({ timeout: 15_000 });
    await expect(carol.getByText('Acceptée')).toBeVisible({ timeout: 15_000 });
    await carol.context().close();
  });

  test('salon de discussion et signalement, puis modération par un administrateur', async ({
    page,
    browser,
    baseURL,
  }, testInfo) => {
    const texte = `Message e2e ${Date.now()}`;
    await page.goto('/communaute/salons');
    await seConnecter(page, 'carol');
    await page.getByRole('link', { name: 'Films et Blu-ray' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Films et Blu-ray' })).toBeFocused();
    await page.getByLabel('Votre message').fill(texte);
    await page.getByRole('button', { name: 'Envoyer', exact: true }).click();
    await expect(page.getByRole('log').getByText(texte)).toBeVisible();
    await auditerAccessibilite(page, testInfo, 'salon');

    const alice = await autreMembre(browser, baseURL, 'alice', '/communaute/salons/films');
    const message = alice.getByRole('log').getByRole('listitem').filter({ hasText: texte });
    await expect(message).toBeVisible();
    await message.getByRole('button', { name: 'Signaler le message de carol' }).click();
    await message.getByLabel(/Motif du signalement/).fill('Signalement du test de bout en bout');
    await message.getByRole('button', { name: 'Envoyer le signalement' }).click();
    await expect(message.getByText(/la modération va examiner ce contenu/)).toBeVisible();
    await alice.context().close();

    const admin = await autreMembre(browser, baseURL, 'admin-pme', '/admin/moderation');
    const ligne = admin.getByRole('row').filter({ hasText: texte });
    await expect(ligne).toBeVisible();
    await auditerAccessibilite(admin, testInfo, 'moderation');
    await ligne.getByRole('button', { name: /Masquer/ }).click();
    await expect(admin.getByText('Contenu masqué ; son auteur est prévenu.')).toBeVisible();
    await admin.context().close();

    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Films et Blu-ray' })).toBeVisible();
    await expect(page.getByRole('log').getByText(texte)).toHaveCount(0);
  });

  test('un compte sans profil client ne peut pas publier', async ({ page }) => {
    await page.goto('/communaute/publier');
    await seConnecter(page, 'bob');
    await expect(page.getByRole('heading', { level: 1, name: 'Accès refusé' })).toBeVisible();
  });
});
