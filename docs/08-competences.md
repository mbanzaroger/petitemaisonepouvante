# Cartographie des compétences

Niveaux requis : **1** notions · **2** autonome · **3** référent · **4** expert. Les profils restent réalistes : aucun profil ne cumule tous les domaines.

## Équipe cible
| Profil | Effectif | Statut |
|---|---|---|
| Lead Developer / architecte logiciel | 1 | En place |
| Développeur back-end (junior) | 2 | En place |
| Développeur front-end / accessibilité | 1 | À recruter |
| Ingénieur DevOps / SRE | 1 | À recruter |
| Référent sécurité applicative | 1 | À recruter (ou prestataire à temps partiel) |

## Matrice compétences × profils
| Domaine | Niveau requis | Lead / architecte | Dév. back (×2) | Dév. front | DevOps / SRE | Réf. sécurité | Écart actuel |
|---|---|---|---|---|---|---|---|
| Java 21 / Spring Boot | 3 | 3 | 2 | – | – | – | Couvert |
| Conception microservices, saga, messagerie (RabbitMQ) | 3 | 3 | 1 | – | 2 | – | **Juniors à monter à 2** |
| Bases de données (PostgreSQL, Flyway) | 2 | 3 | 2 | – | 2 | – | Couvert |
| Tests automatisés (JUnit, Testcontainers, Cucumber) | 3 | 3 | 2 | 2 | 2 | – | **Juniors à monter à 3 sur l'intégration** |
| CI/CD (GitHub Actions) | 3 | 2 | 1 | 1 | 3 | – | Dépend du recrutement DevOps |
| Conteneurs et Kubernetes | 3 | 2 | 1 | – | 3 | – | Dépend du recrutement DevOps |
| DevSecOps (SAST, SCA, scan d'image, DAST) | 3 | 2 | 1 | – | 2 | 3 | **Écart principal → formation** |
| Sécurité applicative (OIDC, Keycloak, OWASP) | 3 | 2 | 1 | 1 | 1 | 3 | **Écart → formation + référent** |
| Observabilité (Prometheus, Grafana, logs) | 2 | 2 | 1 | – | 3 | – | Dépend du recrutement DevOps |
| Front-end moderne et RGAA | 3 | 1 | – | 3 | – | – | Dépend du recrutement front |
| Qualité logicielle (Sonar, dette, revue de code) | 3 | 3 | 2 | 2 | 2 | – | **Juniors à monter à 3 sur la revue** |
| RGPD et protection des données | 2 | 2 | 1 | 1 | 1 | 3 | Couvert via le référent |

## Priorisation des écarts
1. **DevSecOps et sécurité applicative** : risque le plus élevé (plateforme commerciale) → action de formation `09-formation.md`.
2. **Tests d'intégration et revue de code** : conditionnent les indicateurs de couverture et de dette → même action.
3. **Kubernetes, CI/CD, observabilité** : couverts par le recrutement DevOps ; en attendant, le Lead porte le socle du POC.
