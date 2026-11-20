// Rend chaque SVG de ./svg en PNG 600 × 600 (Chromium de Playwright), dans ./png. À lancer depuis frontend/.
import { readdirSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

// Playwright est résolu depuis le dossier courant (frontend/), où il est installé.
const { chromium } = createRequire(join(process.cwd(), 'package.json'))('@playwright/test');

const ici = import.meta.dirname;
const sources = join(ici, 'svg');
const sortie = join(ici, 'png');
mkdirSync(sortie, { recursive: true });

const navigateur = await chromium.launch(
  process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
);
const page = await navigateur.newPage({ viewport: { width: 600, height: 600 } });
for (const fichier of readdirSync(sources).filter((f) => f.endsWith('.svg'))) {
  const svg = readFileSync(join(sources, fichier), 'utf8');
  await page.setContent(`<!doctype html><html><body style="margin:0">${svg}</body></html>`);
  await page.screenshot({ path: join(sortie, fichier.replace('.svg', '.png')), clip: { x: 0, y: 0, width: 600, height: 600 } });
  console.log(fichier);
}
await navigateur.close();
