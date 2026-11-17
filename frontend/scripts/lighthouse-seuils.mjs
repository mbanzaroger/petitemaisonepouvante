// Contrôle des rapports Lighthouse (JSON) produits par le CD : seuils par catégorie, synthèse Markdown.
// Usage : node scripts/lighthouse-seuils.mjs <dossier des rapports>
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const SEUILS = { performance: 0.85, accessibility: 0.95, 'best-practices': 0.9, seo: 0.9 };
const LIBELLES = { performance: 'Performance', accessibility: 'Accessibilité', 'best-practices': 'Bonnes pratiques', seo: 'Référencement' };

const dossier = process.argv[2] ?? 'lighthouse';
const rapports = readdirSync(dossier).filter((f) => f.endsWith('.report.json')).sort();
if (rapports.length === 0) {
  console.error(`Aucun rapport Lighthouse dans ${dossier}`);
  process.exit(1);
}

const echecs = [];
const lignes = [
  `| Page | ${Object.keys(SEUILS).map((c) => `${LIBELLES[c]} (≥ ${Math.round(SEUILS[c] * 100)})`).join(' | ')} |`,
  `|---|${Object.keys(SEUILS).map(() => '---').join('|')}|`,
];
for (const fichier of rapports) {
  const rapport = JSON.parse(readFileSync(join(dossier, fichier), 'utf8'));
  const page = new URL(rapport.finalDisplayedUrl ?? rapport.requestedUrl).pathname;
  const cellules = Object.entries(SEUILS).map(([categorie, seuil]) => {
    const score = rapport.categories[categorie]?.score ?? 0;
    if (score < seuil) {
      const audits = rapport.categories[categorie].auditRefs
        .map((ref) => rapport.audits[ref.id])
        .filter((a) => a && a.score !== null && a.score < 1 && a.scoreDisplayMode !== 'informative')
        .map((a) => a.id)
        .slice(0, 5);
      echecs.push(`${page} : ${LIBELLES[categorie]} ${Math.round(score * 100)} < ${Math.round(seuil * 100)} (${audits.join(', ')})`);
    }
    return `${Math.round(score * 100)}${score < seuil ? ' ❌' : ''}`;
  });
  lignes.push(`| \`${page}\` | ${cellules.join(' | ')} |`);
}
console.log(lignes.join('\n'));
if (echecs.length > 0) {
  console.error(`\nSeuils non atteints :\n- ${echecs.join('\n- ')}`);
  process.exit(1);
}
