# Politique de tests

## Objectifs
Garantir l'adéquation fonctionnelle, la fiabilité et la non-régression, et rendre mesurables les indicateurs 1 (couverture), 3 (performance) et 4 (sécurité).

## Pyramide de tests
| Niveau | Cible | Outils | Quand | Part visée | Seuil bloquant |
|---|---|---|---|---|---|
| Unitaires | Règles métier (calcul du total, transitions de statut, réservation de stock) | JUnit 5, Mockito | À chaque commit | ~70 % | Couverture du code métier ≥ 80 % (JaCoCo) |
| Intégration | Service + PostgreSQL + RabbitMQ réels, migrations Flyway, sécurité JWT | Testcontainers, Spring Boot Test | À chaque PR | ~20 % | 100 % verts |
| Contrat / API | Conformité des endpoints au contrat OpenAPI, codes d'erreur | RestAssured | À chaque PR | inclus | 100 % verts |
| Acceptation | Scénarios Gherkin du backlog (US1 à US4, US8 à US12, US15 à US17) | Cucumber | À chaque PR | ~10 % | 100 % verts |
| Sécurité | Tests négatifs 401/403, SAST, SCA, scan d'image, DAST | CodeQL, SonarQube Cloud, Trivy, ZAP | Pipeline | – | 0 vulnérabilité critique/haute |
| Charge | Tenue en charge du catalogue et de la commande | JMeter (ou Siege) | Avant release, démonstration en soutenance | – | p95 < 300 ms, erreurs < 1 % |
| Front-end : unitaires et composants | Règles du panier (dont revalidation des prix), appels API, corrélation et erreurs problem+json, authentification, pages rendues avec une API simulée (rôles client et administrateur, focus, annonces, filet d'erreur) | Vitest, Testing Library | À chaque PR | 87 tests | Couverture des lignes ≥ 80 % |
| Front-end : bout en bout | Parcours réel dans Chromium sur le staging : connexion Keycloak (PKCE), commande confirmée puis annulée, historique, espace administrateur, refus selon le rôle, pages légales, en-têtes, jetons hors du stockage | Playwright | À chaque déploiement en staging | 10 tests | 100 % verts |
| Accessibilité | 14 pages et états (catalogue, fiche, panier, suivi, historique, stock, connexion requise, pages légales, page introuvable, **page de connexion Keycloak**) ; règles `jsx-a11y` à l'écriture | axe-core (WCAG 2.2 A/AA), ESLint `jsx-a11y` strict | À chaque PR (lint) et à chaque déploiement (axe) | – | 0 violation axe ; audit RGAA manuel avant mise en ligne (R-13) |
| Performance et qualité web | Catalogue, fiche produit, plan du site (profil bureau) ; poids du bundle | Lighthouse 13 ; script de budget (gzip) | À chaque déploiement (Lighthouse), à chaque PR (budget) | – | Performance ≥ 85, accessibilité ≥ 95, bonnes pratiques ≥ 90, référencement ≥ 90 ; premier affichage ≤ 110 Ko, total ≤ 140 Ko |

## Règles
1. **Tout bug corrigé reçoit un test de non-régression** avant ou avec le correctif.
2. **Idempotence testée** : le rejeu d'un même `OrderPlaced` ne décrémente le stock qu'une fois.
3. **Cas limites obligatoires** : stock insuffisant, jeton absent/expiré, commande d'un autre client, message dupliqué, base indisponible.
4. **Tests indépendants et déterministes** : pas d'ordre imposé, données créées par le test, pas d'attente par `sleep`.
5. **Tests instables (flaky)** : mis en quarantaine sous 24 h avec une issue ouverte, corrigés ou supprimés sous une semaine.
6. **Données de test** : jeux synthétiques uniquement, jamais de données réelles.
7. **Quality Gate sur le code nouveau** : le seuil de couverture et la dette s'appliquent au code ajouté, même si l'historique est imparfait.

## Environnements
| Environnement | Tests exécutés |
|---|---|
| Poste local | Unitaires, intégration (Testcontainers) ; front-end : `npm test` |
| CI (GitHub Actions) | Unitaires, intégration, acceptation, SAST, SCA, scan d'image ; front-end : lint, types, Vitest |
| Staging | Smoke tests, Cucumber, bout en bout Playwright + axe, DAST (ZAP, API et site), test de charge |

## Critères d'entrée et de sortie
- **Entrée en test d'acceptation** : build vert, Quality Gate passé.
- **Sortie (livrable)** : tous les tests verts, couverture et dette conformes, aucun scan bloquant, résultats de charge archivés.

## Traçabilité vers les indicateurs
| Indicateur | Source de la mesure |
|---|---|
| Couverture ≥ 80 % | Rapport JaCoCo importé dans SonarQube ; `coverage-summary.json` de Vitest pour le front-end |
| Dette ≤ 5 %, duplication ≤ 3 % | SonarQube |
| p95 < 300 ms, erreurs < 1 % | Rapport JMeter + métriques Prometheus |
| Vulnérabilités critiques/hautes = 0 | Rapports Trivy, CodeQL, ZAP |
| Accessibilité (utilisabilité ISO 25010) | Résultats axe joints au rapport Playwright du CD |
