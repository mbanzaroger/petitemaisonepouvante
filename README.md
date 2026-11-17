# petitemaisonepouvante.com — Plateforme e-commerce (architecture microservices)

[![CI](https://github.com/mbanzaroger/petitemaisonepouvante/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/mbanzaroger/petitemaisonepouvante/actions/workflows/ci.yml)
[![CodeQL](https://github.com/mbanzaroger/petitemaisonepouvante/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/mbanzaroger/petitemaisonepouvante/actions/workflows/codeql.yml)
[![Release](https://img.shields.io/github/v/release/mbanzaroger/petitemaisonepouvante?include_prereleases)](https://github.com/mbanzaroger/petitemaisonepouvante/releases)

> Projet individuel — Bloc CESI « Superviser et assurer le développement des applications logicielles ».
> Cas fictif : *La Petite Maison de l'Épouvante*. Rôle : Lead Developer.

## Périmètre du POC
Fonctionnalité métier implémentée : **commander un produit dérivé (figurines, goodies, Blu-ray) avec réservation de stock**, de bout en bout dans le navigateur.

| Composant | Rôle | Statut |
|---|---|---|
| `web-frontend` | Site : catalogue, panier, connexion, commande, suivi, historique, espace administrateur (stock), pages de conformité (React + TypeScript, ADR-002) | Livré (v1.1.0, complété en v1.2.0) |
| `catalog-service` | Produits, catégories, prix | Livré (v0.5.0) |
| `order-service` | Commandes, statuts, historique, saga (boîte d'envoi) | Livré (v0.5.0) |
| `stock-service` | Stock, réservations idempotentes | Livré (v0.5.0) |
| Keycloak | Identité OIDC / rôles (client `pme-web` : code + PKCE) | `infra/`, `k8s/platform/` |
| RabbitMQ | Saga de commande asynchrone | `infra/`, `k8s/overlays/staging/` |

| Catalogue | Suivi d'une commande |
|---|---|
| ![Catalogue du site : filtre par catégorie, produits, ajout au panier annoncé](docs/assets/site-catalogue.png) | ![Suivi d'une commande confirmée : statut, dates, total et articles](docs/assets/site-suivi.png) |

| Espace administrateur (stock) | Connexion (thème Keycloak du site) |
| ![Page Stock réservée aux administrateurs : disponible, réservé et état par produit](docs/assets/site-stock.png) | ![Page de connexion Keycloak aux couleurs du site, en français](docs/assets/site-connexion.png) |

*Captures du site avec les données de démonstration ; l'historique est en `docs/assets/site-historique.png`.*

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
- [Plan de remédiation](docs/11-plan-remediation.md)
- [Observabilité et supervision (US5)](docs/12-observabilite.md)
- [Analyse de sécurité de la V1 et registre des vulnérabilités](docs/13-analyse-securite.md)
- [Test de charge (indicateur 3)](docs/14-test-de-charge.md)
- [Soutenance : trame, notes et questions](docs/soutenance/support.md)
- [Audit du projet (14/11/2026)](docs/audit/audit-2026-11-14.md)
- [Suivi d'avancement](docs/suivi-avancement.md)
- [Contribuer : branches, commits, versions](CONTRIBUTING.md) · [Sécurité](SECURITY.md) · [Journal des modifications](CHANGELOG.md)
- [ADR-001 : choix microservices](docs/adr/ADR-001-microservices.md) · [ADR-002 : front-end web (révisé)](docs/adr/ADR-002-front-end.md) · [ADR-003 : Gateway API](docs/adr/ADR-003-gateway-api.md)
- [Contrat OpenAPI](docs/api/openapi.yaml) · [Collection Bruno](docs/api/bruno/) · [Script de démonstration](docs/demo/script-demo.md)
- [Protocoles d'expérimentation](docs/experimentations/) · [Synthèse adoption / rejet](docs/experimentations/synthese.md)

## Démarrage local
```bash
infra/init-env.sh                              # génère infra/.env (mots de passe aléatoires, jamais versionné)
cd infra && docker compose --profile app up -d --build
# Site http://localhost:5173 (alice ou carol : client ; admin-pme : stock) — l'API y est relayée sur la même origine
# API : catalogue http://localhost:8081, commandes :8082, stock :8083 (ports liés à 127.0.0.1)
# Keycloak http://localhost:8080 (admin / KEYCLOAK_ADMIN_PASSWORD) · RabbitMQ http://localhost:15672
# Prometheus http://localhost:9090 · Grafana http://localhost:3000 (tableau de bord « PME — RED des microservices »)
```
Comptes de test du royaume `pme` (mots de passe dans `infra/.env`) : `alice` et `carol` (CUSTOMER), `bob` (sans rôle), `admin-pme` (ADMIN).
Sans `--profile app`, seules les dépendances démarrent (pour lancer les services depuis l'IDE).
Pour travailler sur le site : `cd frontend && npm ci && npm run dev` (http://localhost:5173, à la place du conteneur `web-frontend` ; voir [`frontend/README.md`](frontend/README.md)).

**Dans un GitHub Codespace**, les conteneurs ne sont pas sur votre poste : `localhost` ne répond pas dans le navigateur. Le site passe alors par l'adresse publique du Codespace, et Keycloak est relayé par le site sur la même adresse :

```bash
bash infra/codespaces.sh            # écrit PME_SITE_URL et KEYCLOAK_PUBLIC_URL dans infra/.env
cd infra && docker compose --profile app up -d --build --force-recreate
# Ouvrir https://<codespace>-5173.app.github.dev (onglet « Ports », port 5173)
```

## Organisation du dépôt
```
docs/            documentation, schémas (Mermaid), ADR, expérimentations
services/        microservices (catalog, order, stock)
frontend/        site web (SPA React + TypeScript, nginx, tests Vitest et Playwright)
infra/           docker-compose + monitoring (dev local)
k8s/             manifestes Kubernetes (Kustomize)
load-tests/      scénarios JMeter
scripts/         configuration GitHub reproductible (issues, jalons, kanban, releases)
.github/         workflows CI/CD, modèles d'issues et de PR, Dependabot
```

## Pipeline CI/CD
| Workflow | Déclencheur | Rôle |
|---|---|---|
| `ci.yml` | PR, push sur `develop` / `main` | Secrets, SCA, IaC, build et tests, couverture, Quality Gate, image, scan, SBOM, GHCR ; site : lint (dont accessibilité), types, tests, image |
| `codeql.yml` | PR, push, hebdomadaire | SAST Java et analyse des workflows |
| `cd.yml` | Appelé par `ci.yml` après une CI verte sur un push vers `develop` / `main` (ou lancement manuel) | Déploiement sur cluster kind éphémère, smoke tests, acceptation Cucumber, parcours du site dans Chromium (Playwright) et accessibilité (axe), vérification de la supervision, DAST ZAP (API et site) |
| `release.yml` | Release publiée | Images versionnées, SBOM, production sous approbation |

## Avancement
- [x] Cadrage technique validé (v1.0)
- [x] Schémas : architecture, CI/CD, saga
- [x] Infra locale (docker-compose), squelette CI
- [x] Phase 1 complète : cycle DevSecOps, politiques de tests et de sécurité, compétences, formation
- [x] Industrialisation : pipelines CI/CD, gouvernance GitHub, kanban, audit (v0.3.0)
- [x] Expérimentations E1 à E4 et synthèse (v0.4.0)
- [x] Squelettes des 3 services (CI : tests, couverture, scans, images)
- [x] User stories US1 à US5 : staging Kubernetes, tests d'acceptation, supervision (v0.5.0)
- [x] DAST de l'API, test de charge (indicateur 3), analyse de sécurité et plan de remédiation (v0.6.0)
- [x] Support de soutenance, trame et script de démonstration (v1.0.0)
- [x] Site web : SPA React sécurisée et accessible, e2e et axe en staging (v1.1.0, ADR-002 révisé)
- [x] Site web v2 : espace administrateur, conformité RGAA/RGPD, thème de connexion, Lighthouse, observabilité (v1.2.0)
- [ ] Répétitions chronométrées et vidéo de secours (#41)
- [ ] SonarQube Cloud, indicateur 2 (#32)
