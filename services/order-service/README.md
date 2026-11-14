# order-service

Commandes : création, statuts (PENDING, CONFIRMED, CANCELLED), historique par client.

| | |
|---|---|
| Port | 8082 |
| Base | PostgreSQL `orders` (local : `localhost:5434`, voir `infra/docker-compose.yml`) |
| Santé | `/actuator/health` (+ `/liveness`, `/readiness`) |
| Métriques | `/actuator/prometheus` |
| Schéma | `src/main/resources/db/migration/` (Flyway) |

## Construire et tester
```bash
./mvnw verify            # tests unitaires + intégration (Docker requis pour Testcontainers) + JaCoCo ≥ 80 %
docker build -t order-service . # image distroless, utilisateur non root
```

## Lancer en local
```bash
(cd ../../infra && docker compose up -d postgres-orders)
./mvnw spring-boot:run
```

Voir `docs/backlog.md` pour les user stories et `docs/01-architecture.md` pour l'architecture.
