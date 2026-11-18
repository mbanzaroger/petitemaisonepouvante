# community-service

Espace communautaire : annonces de troc et de dons entre particuliers, propositions et conversation privée, salons de discussion, notifications (préférences, objets recherchés) et modération.

| | |
|---|---|
| Port | 8084 |
| Base | PostgreSQL `community` (local : `localhost:5436`, voir `infra/docker-compose.yml`) |
| API | `/api/v1/community/*` (voir `docs/api/openapi.yaml`) |
| Santé | `/actuator/health` (+ `/liveness`, `/readiness`) |
| Métriques | `/actuator/prometheus` (`pme_community_*` en plus des métriques RED) |
| Schéma | `src/main/resources/db/migration/` (Flyway) |

## Règles principales
- Lecture publique des annonces ; toute autre opération réservée aux rôles `CUSTOMER` et `ADMIN`, la modération à `ADMIN`.
- Un membre est identifié par le `subject` du jeton ; seul son nom affiché (`preferred_username`) est montré aux autres.
- Une proposition n'est visible que de ses deux participants (404 pour les autres).
- Anti-flood : 5 messages au plus par membre sur 10 secondes (429) ; 10 objets recherchés au plus.
- Conservation (RGPD) : notifications lues purgées après 90 jours, messages des salons après 365 jours.

## Construire et tester
```bash
./mvnw verify            # tests unitaires + intégration (Docker requis pour Testcontainers) + JaCoCo ≥ 80 %
docker build -t community-service . # image distroless, utilisateur non root
```
