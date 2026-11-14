# petitemaisonepouvante.com — Plateforme e-commerce (architecture microservices)

[![CI](https://github.com/mbanzaroger/petitemaisonepouvante/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/mbanzaroger/petitemaisonepouvante/actions/workflows/ci.yml)
[![CodeQL](https://github.com/mbanzaroger/petitemaisonepouvante/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/mbanzaroger/petitemaisonepouvante/actions/workflows/codeql.yml)
[![Release](https://img.shields.io/github/v/release/mbanzaroger/petitemaisonepouvante?include_prereleases)](https://github.com/mbanzaroger/petitemaisonepouvante/releases)

> Projet individuel — Bloc CESI « Superviser et assurer le développement des applications logicielles ».
> Cas fictif : *La Petite Maison de l'Épouvante*. Rôle : Lead Developer.

## Périmètre du POC
Fonctionnalité métier implémentée : **commander un produit dérivé (figurines, goodies, Blu-ray) avec réservation de stock**.

| Service | Rôle | Statut |
|---|---|---|
| `catalog-service` | Produits, catégories, prix | À implémenter |
| `order-service` | Commandes, statuts, historique | À implémenter |
| `stock-service` | Stock, réservations | À implémenter |
| Keycloak | Identité OIDC / rôles | Infra (`infra/`) |
| RabbitMQ | Saga de commande asynchrone | Infra (`infra/`) |

## Documentation
- [Architecture technique + sécurité](docs/01-architecture.md)
- [Pipeline CI/CD DevSecOps](docs/02-cicd-pipeline.md)
- [Saga de commande (séquence)](docs/03-saga-commande.md)
- [Backlog du POC (US + critères d'acceptation)](docs/backlog.md)
- [Indicateurs qualité (ISO 25010)](docs/04-indicateurs-qualite.md)
- [Cycle DevSecOps complet + STRIDE](docs/05-cycle-devsecops.md)
- [Politique de tests](docs/06-politique-tests.md)
- [Politique de sécurité](docs/07-politique-securite.md)
- [Cartographie des compétences](docs/08-competences.md)
- [Action de formation](docs/09-formation.md)
- [Gouvernance du dépôt et de la livraison](docs/10-gouvernance-depot.md)
- [Audit du projet (14/11/2026)](docs/audit/audit-2026-11-14.md)
- [Suivi d'avancement](docs/suivi-avancement.md)
- [Contribuer : branches, commits, versions](CONTRIBUTING.md) · [Sécurité](SECURITY.md) · [Journal des modifications](CHANGELOG.md)
- [ADR-001 : choix microservices](docs/adr/ADR-001-microservices.md) · [ADR-003 : Gateway API](docs/adr/ADR-003-gateway-api.md)
- [Protocoles d'expérimentation](docs/experimentations/) · [Synthèse adoption / rejet](docs/experimentations/synthese.md)

## Démarrage local (infrastructure)
```bash
cd infra
docker compose up -d
# Keycloak : http://localhost:8080  (admin / admin — dev uniquement)
# RabbitMQ : http://localhost:15672 (guest / guest — dev uniquement)
# Prometheus : http://localhost:9090 | Grafana : http://localhost:3000
```

## Organisation du dépôt
```
docs/            documentation, schémas (Mermaid), ADR, expérimentations
services/        microservices (catalog, order, stock)
infra/           docker-compose + monitoring (dev local)
k8s/             manifestes Kubernetes (Kustomize)
load-tests/      scénarios JMeter
scripts/         configuration GitHub reproductible (issues, jalons, kanban, releases)
.github/         workflows CI/CD, modèles d'issues et de PR, Dependabot
```

## Pipeline CI/CD
| Workflow | Déclencheur | Rôle |
|---|---|---|
| `ci.yml` | PR, push sur `develop` / `main` | Secrets, SCA, IaC, build et tests, couverture, Quality Gate, image, scan, SBOM, GHCR |
| `codeql.yml` | PR, push, hebdomadaire | SAST Java et analyse des workflows |
| `cd.yml` | CI verte sur `develop` / `main` | Déploiement sur cluster kind éphémère, smoke tests, DAST ZAP |
| `release.yml` | Release publiée | Images versionnées, SBOM, production sous approbation |

## Avancement
- [x] Cadrage technique validé (v1.0)
- [x] Schémas : architecture, CI/CD, saga
- [x] Infra locale (docker-compose), squelette CI
- [x] Phase 1 complète : cycle DevSecOps, politiques de tests et de sécurité, compétences, formation
- [x] Industrialisation : pipelines CI/CD, gouvernance GitHub, kanban, audit (v0.3.0)
- [x] Expérimentations E1 à E4 et synthèse (v0.4.0)
- [x] Squelettes des 3 services (CI : tests, couverture, scans, images)
- [ ] User stories US1 à US5
- [ ] Scans, test de charge, plan de remédiation
