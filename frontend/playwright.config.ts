import { defineConfig, devices } from '@playwright/test';

/**
 * Tests de bout en bout du site sur le staging (CD) : vrai Keycloak, vrai Gateway, vrais services.
 * Variables : SITE_URL (https://app.pme.local:8443 par défaut), PME_ALICE_PASSWORD, PME_BOB_PASSWORD.
 * L'autorité de certification du staging est propre au cluster : les erreurs de certificat sont ignorées ici
 * (le TLS lui-même est vérifié par les smoke tests avec le certificat de l'AC).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  outputDir: 'test-results',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: process.env.SITE_URL ?? 'https://app.pme.local:8443',
    ignoreHTTPSErrors: true,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    // Pas de trace en CI : elle enregistrerait les valeurs saisies (mots de passe éphémères du staging).
    trace: process.env.CI ? 'off' : 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
