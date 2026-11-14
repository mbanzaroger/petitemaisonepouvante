# catalog-service

Catalogue des produits dérivés : produits, catégories, prix, disponibilité affichée.

| | |
|---|---|
| Port | 8081 |
| Base | PostgreSQL `catalog` (local : `localhost:5433`, voir `infra/docker-compose.yml`) |
| Santé | `/actuator/health` (+ `/liveness`, `/readiness`) |
| Métriques | `/actuator/prometheus` |
| Schéma | `src/main/resources/db/migration/` (Flyway) |

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
