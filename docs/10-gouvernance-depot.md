# Gouvernance du dépôt et de la livraison

Ce document montre comment le Lead Developer supervise la chaîne de livraison : organisation du travail (issues, kanban, jalons), flux Git (branches, PR, versions) et règles d'automatisation (workflows, environnements, protections).

## 1. Organisation du travail

| Élément | Mise en œuvre | Rôle |
|---|---|---|
| Issues | Modèles : user story, expérimentation, tâche technique, bug, vulnérabilité | Une issue par unité de travail, critères de fin explicites |
| Labels | `type:*`, `svc:*`, `prio:P1..P3`, `phase:*`, `audit` | Filtrer par nature, service, priorité et phase des consignes |
| Jalons | J0 à J5, un jalon par version | Mesurer l'avancement de chaque phase |
| Kanban | GitHub Projects : Backlog → À faire → En cours → En revue → Terminé, champ Priorité | Visualiser le flux, limiter le travail en cours |

| Jalon | Version | Contenu |
|---|---|---|
| J0 — Cadrage | v0.1.0 | Cadrage, ADR-001, schémas, infrastructure locale |
| J1 — Processus qualité | v0.2.0 | Phase 1 des consignes |
| Industrialisation CI/CD et audit | v0.3.0 | Pipelines, gouvernance, audit |
| J2 — Expérimentations | v0.4.0 | E1 à E4, synthèse adoption/rejet |
| J3 — POC | v0.5.0 | Services, US1 à US5, tests d'acceptation, Kubernetes |
| J4 — Sécurité, charge, remédiation | v0.6.0 | Phase 3 des consignes |
| J5 — Soutenance | v1.0.0 | Version présentée |

## 2. Flux Git
Détail dans `CONTRIBUTING.md`. En résumé :
- `main` : versions livrées, taguées `vX.Y.Z` ; `develop` : intégration, déployée automatiquement en staging.
- Branches de travail courtes : `feature/<issue>-<slug>`, `exp/<E#>-<slug>`, `fix/…`, `hotfix/…`, `docs/…`.
- Commits et titres de PR au format Conventional Commits (contrôlé par la CI).
- Fusion `feature → develop` en squash ; `develop → main` par PR de release, puis tag et release.

## 3. Protections et contrôles automatiques

| Règle | Où | Effet |
|---|---|---|
| PR obligatoire, check « Résultat CI » vert, conversations résolues, pas de force-push ni de suppression | `main`, `develop` | Aucun code non vérifié n'atteint les branches partagées |
| Approbation requise : 0 (projet individuel), auto-revue via le modèle de PR et la revue outillée (CodeQL, SonarQube Cloud) | PR | Passe à 1 approbation dès qu'un second développeur rejoint l'équipe |
| CODEOWNERS | `.github/`, `k8s/`, `infra/`, politique de sécurité | Revue du Lead sur les zones sensibles |
| Environnement `production` : approbation du propriétaire, limité aux tags `v*` et à `main` | `release.yml` | Validation manuelle avant production |
| Dependabot (actions, Maven, images, docker-compose) | `.github/dependabot.yml` | Mises à jour hebdomadaires vers `develop` |
| Secret scanning + push protection, alertes Dependabot, signalement privé | Paramètres du dépôt | Détection et signalement des vulnérabilités |
| Actions tierces épinglées par SHA | Workflows | Résistance aux tags de version compromis |

## 4. Contrat des workflows de déploiement
Le workflow `cd.yml` s'active automatiquement dès que ces fichiers existent ; tant qu'ils sont absents, il se termine sans erreur et l'indique dans le résumé du run.

| Fichier | Obligatoire | Rôle |
|---|---|---|
| `k8s/overlays/staging/kustomization.yaml` | Oui | Déploiement staging ; images nommées `catalog-service`, `order-service`, `stock-service` |
| `k8s/kind-config.yaml` | Non | Configuration du cluster kind (ports, nœuds) |
| `k8s/staging-bootstrap.sh` | Non | Installe le socle (Envoy Gateway, cert-manager, Keycloak, RabbitMQ, PostgreSQL) et écrit `BASE_URL=…` dans `$GITHUB_ENV` |
| `scripts/smoke-test.sh` | Non | Reçoit `BASE_URL`, échoue si un appel clé échoue |
| `.zap/rules.tsv` | Non | Qualification des alertes ZAP (IGNORE / WARN / FAIL) |
| `k8s/overlays/production/kustomization.yaml` + secret `KUBE_CONFIG_PROD` | Non | Déploiement réel en production depuis `release.yml` |

## 5. Secrets et variables du dépôt

| Nom | Type | Usage |
|---|---|---|
| `SONAR_TOKEN` | Secret | Analyse SonarQube Cloud et Quality Gate (job ignoré si absent) |
| `SONAR_ORGANIZATION` | Variable | Organisation SonarQube Cloud (défaut : `mbanzaroger`) |
| `KUBE_CONFIG_PROD` | Secret d'environnement `production` | Accès au cluster de production (optionnel) |

## 6. Mise en place
`scripts/bootstrap/` contient la configuration GitHub reproductible :
- `github-bootstrap.sh` : paramètres de sécurité, labels, jalons, issues, environnements, protections, releases (API REST, idempotent) ;
- `kanban.sh` : kanban GitHub Projects (nécessite `gh auth refresh -s project`) ;
- `issues/`, `releases/`, `labels.tsv`, `milestones.tsv` : données versionnées, relisibles en revue de code.
