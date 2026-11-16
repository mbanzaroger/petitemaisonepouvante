import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, type TestInfo } from '@playwright/test';

export const MUG = { id: '0f6c1a10-0008-4000-8000-000000000008', nom: 'Mug « Le lieu de rêve pour frissonner »' };
/** Stock initial de 2 : une commande de 10 est annulée par la saga (scénario d'échec). */
export const BUSTE = { id: '0f6c1a10-0002-4000-8000-000000000002', nom: "Buste de L'Orc peint à la main" };

export function motDePasse(utilisateur: 'alice' | 'bob'): string {
  const valeur = process.env[`PME_${utilisateur.toUpperCase()}_PASSWORD`];
  if (!valeur) throw new Error(`PME_${utilisateur.toUpperCase()}_PASSWORD non défini`);
  return valeur;
}

/** Connexion par la page de Keycloak (flux code + PKCE), puis retour sur la page de départ. */
export async function seConnecter(page: Page, utilisateur: 'alice' | 'bob', bouton = 'Se connecter') {
  await page.getByRole('button', { name: bouton, exact: true }).first().click();
  await page.waitForURL(/\/realms\/pme\/protocol\/openid-connect\/auth/);
  await page.locator('#username').fill(utilisateur);
  await page.locator('#password').fill(motDePasse(utilisateur));
  await page.locator('#kc-login').click();
  await expect(page.getByText(`Bonjour ${utilisateur}`)).toBeVisible();
}

const NORMES = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Audit axe-core (critères WCAG A/AA, base du RGAA 4.1) et capture jointe au rapport. */
export async function auditerAccessibilite(page: Page, testInfo: TestInfo, nom: string) {
  const resultat = await new AxeBuilder({ page }).withTags(NORMES).analyze();
  await testInfo.attach(`axe-${nom}.json`, { body: JSON.stringify(resultat.violations, null, 2), contentType: 'application/json' });
  await testInfo.attach(`${nom}.png`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  const resume = resultat.violations.map((v) => `${v.id} (${v.impact}) : ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  expect(resume, `violations d'accessibilité sur « ${nom} »`).toEqual([]);
}
