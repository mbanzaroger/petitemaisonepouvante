# web-frontend — site petitemaisonepouvante.com

SPA React 19 + TypeScript (Vite) : catalogue, fiche produit, panier revalidé, connexion Keycloak (code + PKCE S256),
commande, suivi en direct, historique, espace administrateur (stock) et pages de conformité (plan du site,
accessibilité, mentions légales, données personnelles). Choix et compromis : [ADR-002 révisé](../docs/adr/ADR-002-front-end.md),
sécurité : [analyse de sécurité §4](../docs/13-analyse-securite.md).

| Commande | Rôle |
|---|---|
| `npm ci` | dépendances exactes du lockfile |
| `npm run dev` | serveur de développement sur http://localhost:5173 (API relayée vers les services du `docker compose --profile app`) |
| `npm run lint` / `npm run typecheck` | ESLint (dont `jsx-a11y` strict) et TypeScript strict |
| `npm test` / `npm run test:coverage` | tests unitaires et de composants (Vitest, Testing Library), seuil 80 % des lignes |
| `npm run build` | bundle de production dans `dist/` (aucun script ni style en ligne : CSP stricte) |
| `npm run budget` | poids gzip du premier affichage (≤ 110 Ko) et de l'ensemble (≤ 140 Ko), après `build` |
| `npm run e2e` | tests de bout en bout Playwright + axe sur un site déployé (`SITE_URL`, `PME_ALICE_PASSWORD`, `PME_BOB_PASSWORD`, `PME_ADMIN_PME_PASSWORD` ; `PW_CHROMIUM_PATH` pour un Chromium déjà installé) |
| `node scripts/lighthouse-seuils.mjs <dossier>` | contrôle des rapports Lighthouse JSON produits par le CD (seuils par catégorie) |

L'image (`Dockerfile`) sert le bundle avec nginx non root (port 8080, système de fichiers en lecture seule).
La configuration propre à l'environnement est lue au démarrage via `/config.json`, généré par nginx à partir
de `KEYCLOAK_URL`, `KEYCLOAK_REALM` et `KEYCLOAK_CLIENT_ID` ; aucune URL n'est compilée dans le bundle.

Arborescence : `src/api` (appels REST et erreurs problem+json), `src/auth` (keycloak-js, jetons en mémoire),
`src/cart` (panier en stockage de session), `src/pages` (dont `admin/` et `infos/`, chargées à la demande),
`src/components`, `e2e` (Playwright), `scripts` (budget, seuils Lighthouse). Journaux nginx en JSON et
métriques `stub_status` sur le port 8081 du pod (lues par l'exporteur, `docs/12`).
