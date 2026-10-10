# Politique de tests

## Objectifs
Garantir l'adéquation fonctionnelle, la fiabilité et la non-régression, et rendre mesurables les indicateurs 1 (couverture), 3 (performance) et 4 (sécurité).

## Pyramide de tests
| Niveau | Cible | Outils | Quand | Part visée | Seuil bloquant |
|---|---|---|---|---|---|
| Unitaires | Règles métier (calcul du total, transitions de statut, réservation de stock) | JUnit 5, Mockito | À chaque commit | ~70 % | Couverture du code métier ≥ 80 % (JaCoCo) |
| Intégration | Service + PostgreSQL + RabbitMQ réels, migrations Flyway, sécurité JWT | Testcontainers, Spring Boot Test | À chaque PR | ~20 % | 100 % verts |
| Contrat / API | Conformité des endpoints au contrat OpenAPI, codes d'erreur | RestAssured | À chaque PR | inclus | 100 % verts |
| Acceptation | Scénarios Gherkin du backlog (US1 à US4) | Cucumber | À chaque PR | ~10 % | 100 % verts |
| Sécurité | Tests négatifs 401/403, SAST, SCA, scan d'image, DAST | Sonar, Dependency-Check, Trivy, ZAP | Pipeline | – | 0 vulnérabilité critique/haute |
| Charge | Tenue en charge du catalogue et de la commande | JMeter (ou Siege) | Avant release, démonstration en soutenance | – | p95 < 300 ms, erreurs < 1 % |
| Accessibilité | Contrôles automatisés RGAA sur les pages clés | axe | À chaque PR front | – | 0 erreur bloquante |

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
| Poste local | Unitaires, intégration (Testcontainers) |
| CI (GitHub Actions) | Unitaires, intégration, acceptation, SAST, SCA, scan d'image |
| Staging | Smoke tests, DAST (ZAP), test de charge |

## Critères d'entrée et de sortie
- **Entrée en test d'acceptation** : build vert, Quality Gate passé.
- **Sortie (livrable)** : tous les tests verts, couverture et dette conformes, aucun scan bloquant, résultats de charge archivés.

## Traçabilité vers les indicateurs
| Indicateur | Source de la mesure |
|---|---|
| Couverture ≥ 80 % | Rapport JaCoCo importé dans SonarQube |
| Dette ≤ 5 %, duplication ≤ 3 % | SonarQube |
| p95 < 300 ms, erreurs < 1 % | Rapport JMeter + métriques Prometheus |
| Vulnérabilités critiques/hautes = 0 | Rapports Trivy, Dependency-Check, ZAP |
