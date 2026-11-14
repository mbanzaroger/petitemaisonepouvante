# catalog-service

Catalogue des produits dérivés : produits, catégories, prix, disponibilité affichée.

| | |
|---|---|
| Port | 8081 |
| Base | PostgreSQL `catalog` (local : `localhost:5433`, voir `infra/docker-compose.yml`) |
| Santé | `/actuator/health` (+ `/liveness`, `/readiness`) |
| Métriques | `/actuator/prometheus` |
| Schéma | `src/main/resources/db/migration/` (Flyway) |

## API (v1)
| Méthode | Chemin | Accès | Description |
|---|---|---|---|
| GET | `/api/v1/products?page=&size=&category=` | public | Liste paginée des produits en vente (US1) |
| GET | `/api/v1/products?ids=a,b` | public | Lecture groupée, utilisée par order-service pour relire les prix |
| GET | `/api/v1/products/{id}` | public | Fiche produit, 404 `problem+json` si inconnu |
| GET | `/api/v1/categories` | public | Catégories |

Toute autre opération exige un jeton Keycloak valide (émetteur, audience `pme-api`). Données de démonstration : `V2__donnees_demo.sql`.

## Construire et tester
```bash
./mvnw verify            # tests unitaires + intégration (Docker requis pour Testcontainers) + JaCoCo ≥ 80 %
docker build -t catalog-service . # image distroless, utilisateur non root
```

## Lancer en local
```bash
(cd ../../infra && docker compose up -d postgres-catalog)
./mvnw spring-boot:run
```

Voir `docs/backlog.md` pour les user stories et `docs/01-architecture.md` pour l'architecture.
