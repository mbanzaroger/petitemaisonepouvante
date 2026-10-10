# Action de formation — « DevSecOps et tests d'intégration sur microservices »

## Contexte et justification
La cartographie (`08-competences.md`) montre que les développeurs juniors n'ont pas encore le niveau requis en DevSecOps, en sécurité applicative et en tests d'intégration. Ces écarts menacent directement les indicateurs de couverture, de dette et de vulnérabilités.

## Public et prérequis
- **Public** : 2 développeurs back-end juniors ; le développeur front est invité à la journée 2.
- **Prérequis** : bases de Java et de Git ; une première expérience d'un test unitaire.

## Objectifs pédagogiques (mesurables)
À l'issue de la formation, chaque participant sait :
1. écrire un test d'intégration avec Testcontainers pour un service Spring Boot et PostgreSQL ;
2. protéger un endpoint par JWT/rôles et écrire les tests négatifs 401/403 ;
3. lire un rapport Trivy ou Dependency-Check, qualifier une vulnérabilité et la corriger ;
4. expliquer et faire passer/échouer un Quality Gate SonarQube ;
5. relire une pull request avec une grille de revue sécurité.

## Programme
| Jour | Contenu | Format |
|---|---|---|
| **J1 matin** | Modèle DevSecOps, STRIDE sur le flux de commande, OWASP Top 10 appliqué au projet | Exposé court + atelier de modélisation |
| **J1 après-midi** | Tests : pyramide, Testcontainers, idempotence de la saga, cas limites | Atelier pratique sur `stock-service` |
| **J2 matin** | Sécurité applicative : OIDC/Keycloak, validation du JWT, rôles, tests 401/403 | Atelier pratique sur `order-service` |
| **J2 après-midi** | Pipeline : Sonar (Quality Gate), Dependency-Check, Trivy, gitleaks ; lecture et traitement d'un rapport | Atelier + mise en situation |

Durée : **2 jours**, puis **4 semaines de pair programming** (2 h par semaine avec le Lead) sur des tâches réelles du backlog, pour ancrer les acquis.

## Modalités
- Format : présentiel ou distanciel, groupes de 2 à 4 personnes, 70 % de pratique.
- Support : dépôt du projet (branche d'exercices), documentation `docs/05` à `07`.
- Animateur : Lead Developer, avec intervention du référent sécurité sur la journée 2.

## Évaluation (modèle de Kirkpatrick)
| Niveau | Mesure | Moment |
|---|---|---|
| 1. Réaction | Questionnaire de satisfaction | Fin de J2 |
| 2. Apprentissage | Exercice noté : corriger une vulnérabilité injectée, faire passer un Quality Gate, écrire un test d'intégration | Fin de J2 |
| 3. Comportement | Qualité des PR : respect de la grille de revue, tests négatifs présents | À 4 semaines |
| 4. Résultats | Indicateurs du projet : couverture ≥ 80 %, dette ≤ 5 %, 0 vulnérabilité critique/haute | À 4 semaines et en continu |

## Critères de réussite
- Les 5 objectifs sont validés par l'exercice de fin de formation.
- Aucune PR fusionnée sans test négatif de sécurité sur un endpoint protégé.
- Les indicateurs 1, 2 et 4 respectent leurs seuils sur le code produit après la formation.

## Suites
Reconduire la session à chaque arrivée d'un nouveau membre ; ajouter un module Kubernetes/observabilité quand le DevOps rejoint l'équipe.
