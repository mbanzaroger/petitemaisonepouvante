import { expect, test } from '@playwright/test';
import { auditerAccessibilite, seConnecter } from './outils';

test.describe('Recommandations et exclusivités Evil Ed (US13)', () => {
  test('un membre active la personnalisation puis reçoit des recommandations selon sa navigation', async ({
    page,
  }, testInfo) => {
    await page.goto('/?exclusif=1');
    await expect(page.getByText(/de la gamme exclusive Evil Ed/)).toBeVisible();
    await expect(page.getByRole('main').getByText('Exclusivité Evil Ed').first()).toBeVisible();
    await expect(page.getByRole('region', { name: 'Exclusivités et sélection de la boutique' })).toBeVisible();

    await page.goto('/mon-espace');
    await seConnecter(page, 'alice');
    const section = page.getByRole('region', { name: 'Recommandations' });
    const consentement = section.getByLabel(/Personnaliser les recommandations/);
    await consentement.check();
    await section.getByRole('button', { name: 'Enregistrer mon choix' }).click();
    await expect(section.getByText('Recommandations personnalisées activées.')).toBeVisible();

    await page.goto('/?categorie=Jeux%20de%20soci%C3%A9t%C3%A9');
    const recommandations = page.getByRole('region', { name: 'Recommandé pour vous' });
    await expect(recommandations).toBeVisible();
    await page.reload();
    await expect(recommandations.getByText(/catégorie « Jeux de société »/).first()).toBeVisible();
    await auditerAccessibilite(page, testInfo, 'catalogue-recommandations');

    // Retirer son consentement efface l'historique : la sélection redevient commune.
    await page.goto('/mon-espace');
    await consentement.uncheck();
    await section.getByRole('button', { name: 'Enregistrer mon choix' }).click();
    await expect(section.getByText(/historique effacé/)).toBeVisible();
  });
});
