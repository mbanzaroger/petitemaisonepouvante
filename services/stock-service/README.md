# stock-service

Stock et réservations ; consomme OrderPlaced et publie StockReserved ou StockRejected (saga).

| | |
|---|---|
| Port | 8083 |
| Base | PostgreSQL `stock` (local : `localhost:5435`, voir `infra/docker-compose.yml`) |
| Santé | `/actuator/health` (+ `/liveness`, `/readiness`) |
| Métriques | `/actuator/prometheus` |
| Schéma | `src/main/resources/db/migration/` (Flyway) |

## Construire et tester
```bash
./mvnw verify            # tests unitaires + intégration (Docker requis pour Testcontainers) + JaCoCo ≥ 80 %
docker build -t stock-service . # image distroless, utilisateur non root
```

## Lancer en local
```bash
(cd ../../infra && docker compose up -d postgres-stock)
./mvnw spring-boot:run
```

Voir `docs/backlog.md` pour les user stories et `docs/01-architecture.md` pour l'architecture.
