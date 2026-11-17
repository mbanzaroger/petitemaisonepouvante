# ADR-002 — Front-end web : SPA minimale, sécurisée et accessible

- **Statut** : accepté, **révisé le 16/11/2026** (#92). Remplace la décision du 14/11/2026 (POC démontré par l'API seule), conservée plus bas.
- **Contexte de la révision** : la vérification du backend par l'utilisateur est concluante, mais un site sans interface ne permet pas de montrer le parcours client au jury ni de traiter deux exigences du schéma d'architecture restées « au plan » : l'accessibilité (RGAA) et la sécurité côté navigateur (stockage des jetons, CSP). Le backend étant stabilisé (v1.0.0), l'effort d'une SPA ciblée est désormais soutenable sans dégrader la sécurité, la saga ni le déploiement.

## Décision

Livrer la SPA `web-frontend` **minimale** du schéma d'architecture, limitée aux US1 à US4 :

| Sujet | Choix | Raison |
|---|---|---|
| Pile | React 19 + TypeScript strict, Vite, React Router | Écosystème le plus outillé pour l'accessibilité (Testing Library, axe, jsx-a11y) et le recrutement (`docs/08`) |
| Pages | Catalogue (filtre, pagination), fiche produit, panier, suivi de commande, historique | Couvre US1 à US4 ; le suivi interroge l'API pendant la saga et annonce le statut |
| Authentification | Client public `pme-web`, code d'autorisation + **PKCE S256** (keycloak-js), vérification silencieuse de session | Flux recommandé pour une SPA (OAuth 2.0 for Browser-Based Apps) ; pas de secret côté navigateur |
| Jetons | **En mémoire uniquement**, renouvelés 30 s avant expiration à chaque appel | Un script injecté ne trouve rien dans `localStorage`/`sessionStorage` ; la durée de vie de 5 min borne l'exposition |
| Exposition | `app.pme.local` derrière le Gateway, **même origine** que l'API (les routes catalogue et commandes répondent aussi sur ce nom) | Ni CORS ni cookie : pas de CSRF ; mêmes politiques JWT et limitation de débit qu'`api.pme.local` |
| Service | nginx non root (UID 101), système de fichiers en lecture seule, `config.json` généré au démarrage | Une seule image pour tous les environnements ; aucune URL compilée dans le bundle |
| Navigateur | CSP stricte (`script-src 'self'`, aucun style ni script en ligne), `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, COOP/CORP | Réduit l'impact d'une injection et interdit l'intégration du site par un tiers |
| Accessibilité | RGAA 4.1 : lien d'évitement, titre et focus à chaque navigation, zones de statut, tableaux et formulaires étiquetés, contrastes ≥ 4,5:1 | Obligation légale pour un site marchand (directive européenne 2019/882 transposée, en vigueur depuis juin 2025, hors microentreprises) et engagement d'image auprès d'une communauté de fans |
| Qualité | ESLint (`jsx-a11y` strict), Vitest + Testing Library (couverture ≥ 80 %), Playwright + axe sur le staging, ZAP baseline du site | Mêmes indicateurs que les services (`docs/04`) |

## Compléments du 17/11/2026 (#100)

| Sujet | Décision | Raison |
|---|---|---|
| Espace administrateur | Page « Stock » réservée au rôle ADMIN, lue en direct sur `GET /api/v1/stock/{id}` ; route stock ouverte aussi sur `app.pme.local`, avec la même `SecurityPolicy` (JWT + ADMIN) | Montrer l'effet de la saga côté exploitation et le contrôle d'accès par rôle de bout en bout |
| Conformité | Plan du site (RGAA 12.1), déclaration d'accessibilité « non conforme » tant que l'audit n'est pas fait, mentions légales, données personnelles et cookies ; mention de l'état de conformité dans le pied de page | Exigences du RGAA et du RGPD ; ne rien affirmer qui ne soit mesuré |
| Page de connexion | Thème Keycloak « pme » (CSS seulement) aux couleurs du site, en français, contrôlé par axe | Parcours homogène ; aucune page non vérifiée dans le parcours d'achat |
| Robustesse | Panier revalidé à l'ouverture, filet d'erreur, pages connectées et légales chargées à la demande | Prix affiché fidèle au prix facturé ; jamais de page blanche ; premier affichage léger |
| Observabilité | `X-Correlation-Id` (`web-…`) envoyé par le site, journaux nginx JSON sans IP, exporteur nginx | Diagnostic de bout en bout depuis une référence donnée par le client ; minimisation des données |
| Qualité web | Lighthouse et budget de poids en CI/CD | Rendre mesurables la performance et l'accessibilité perçues |

## Conséquences

- **Positives** : parcours client démontrable dans un navigateur, sur le vrai staging (Keycloak, Gateway, saga) ; accessibilité et sécurité navigateur mesurées à chaque déploiement au lieu d'être promises ; le contrat OpenAPI et les tests d'API restent la référence.
- **Négatives** : une quatrième image à maintenir (Node pour la construction, nginx à l'exécution) et une chaîne de dépendances npm à surveiller (lockfile, `npm ci --ignore-scripts`, Dependabot, Trivy) ; les contrôles automatisés ne couvrent qu'une partie du RGAA (environ 30 % des critères) : un audit manuel reste nécessaire avant la mise en ligne (plan de remédiation, R-13, #94).
- **Risque accepté** : pas de `Cross-Origin-Embedder-Policy`, qui bloquerait l'iframe de vérification de session Keycloak (V-25, `docs/13` §7).

## Alternatives écartées

| Alternative | Motif du rejet |
|---|---|
| Garder le POC sans interface (décision du 14/11) | Parcours client non démontrable ; RGAA et sécurité navigateur jamais mesurés |
| BFF (backend for frontend) avec cookie de session | Un service de plus, gestion du CSRF et des sessions ; justifié pour des jetons longs ou des API tierces, pas pour des jetons de 5 min sur une API interne |
| Rendu serveur (Next.js) | Serveur Node à exploiter et à durcir en production pour un gain de référencement inutile au POC |
| Jetons dans `localStorage` | Lisibles par tout script exécuté dans la page (XSS) |
| Site sur une origine distincte avec CORS | Configuration CORS à maintenir dans chaque service, prévols supplémentaires, surface d'erreur (règle ZAP 10098) |

## Décision initiale (14/11/2026, remplacée)

Le POC était démontré **par l'API** (contrat OpenAPI, collection Bruno, Cucumber sur staging) ; la SPA restait dans l'architecture cible et le client Keycloak `pme-web` était déjà configuré pour elle. Motif : concentrer l'effort sur la sécurité, la saga, le déploiement et la charge. Conséquence négative relevée à l'époque, et levée par cette révision : accessibilité et sécurité navigateur non démontrées.
