# petitemaisonepouvante.com — Plateforme e-commerce (architecture microservices)

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
- [ADR-001 : choix microservices](docs/adr/ADR-001-microservices.md)
- [Protocoles d'expérimentation](docs/experimentations/)

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
.github/         pipeline CI/CD (GitHub Actions)
```

## Avancement
- [x] Cadrage technique validé (v1.0)
- [x] Schémas : architecture, CI/CD, saga
- [x] Infra locale (docker-compose), squelette CI
- [ ] Expérimentations E1 à E3
- [ ] Implémentation des 3 services
- [ ] Scans, test de charge, plan de remédiation
