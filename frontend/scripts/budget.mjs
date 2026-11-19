// Budget de poids du site (gzip), contrôlé en CI après le build : le parcours d'achat reste léger sur mobile.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_ENTREE_KO = 110; // bundle chargé au premier affichage (React, routeur, keycloak-js, parcours d'achat)
// Total relevé de 140 à 155 Ko en v1.5.0 : pages d'administration de la boutique chargées à la demande (produits,
// commandes clients) ; le premier affichage, seul vu par tous les visiteurs, garde son budget.
const BUDGET_TOTAL_KO = 155; // JavaScript et CSS de toutes les pages

const dossier = join(import.meta.dirname, '..', 'dist', 'assets');
const fichiers = readdirSync(dossier)
  .filter((f) => f.endsWith('.js') || f.endsWith('.css'))
  .map((f) => ({ nom: f, ko: gzipSync(readFileSync(join(dossier, f)), { level: 9 }).length / 1024 }));
const index = readFileSync(join(import.meta.dirname, '..', 'dist', 'index.html'), 'utf8');
const entree = fichiers.filter((f) => index.includes(`/assets/${f.nom}`));
const somme = (liste) => liste.reduce((t, f) => t + f.ko, 0);
const ko = (n) => `${n.toFixed(1)} Ko`;

const lignes = [
  '| Ensemble | Poids gzip | Budget |',
  '|---|---|---|',
  `| Premier affichage (${entree.map((f) => f.nom).join(', ')}) | ${ko(somme(entree))} | ${BUDGET_ENTREE_KO} Ko |`,
  `| Total (${fichiers.length} fichiers) | ${ko(somme(fichiers))} | ${BUDGET_TOTAL_KO} Ko |`,
];
console.log(lignes.join('\n'));
if (somme(entree) > BUDGET_ENTREE_KO || somme(fichiers) > BUDGET_TOTAL_KO) {
  console.error('Budget de poids dépassé');
  process.exit(1);
}
