# Architecture technique et sécurité

```mermaid
flowchart TB
    U["Client (navigateur)"] -->|"HTTPS / TLS 1.2+"| ING

    subgraph K8S["Cluster Kubernetes (hébergement UE)"]
        direction TB
        subgraph EDGE["Zone exposée"]
            ING["Gateway API — Envoy Gateway<br/>TLS cert-manager, JWT + rôles, rate limiting"]
            FE["web-frontend (SPA)<br/>hors POC — ADR-002"]
        end
        subgraph APP["Zone applicative (NetworkPolicies deny-all par défaut)"]
            CAT["catalog-service<br/>Spring Boot"]
            ORD["order-service<br/>Spring Boot"]
            STK["stock-service<br/>Spring Boot"]
            KC["Keycloak<br/>OIDC / JWT"]
        end
        subgraph DATA["Zone données (non exposée)"]
            DBC[("PostgreSQL catalog")]
            DBO[("PostgreSQL orders")]
            DBS[("PostgreSQL stock")]
            MQ{{"RabbitMQ"}}
        end
        subgraph OBS["Observabilité"]
            PROM["Prometheus"]
            GRAF["Grafana"]
            ALERT["Alertmanager"]
        end
    end

    ING --> FE
    ING -->|"REST /api/v1/products"| CAT
    ING -->|"REST /api/v1/orders + JWT vérifié"| ORD
    ORD -->|"REST : prix et disponibilité"| CAT
    ORD -->|"événement OrderPlaced"| MQ
    MQ -->|"OrderPlaced"| STK
    STK -->|"StockReserved / StockRejected"| MQ
    MQ -->|"résultat de réservation"| ORD
    CAT --- DBC
    ORD --- DBO
    STK --- DBS
    FE -->|"OIDC (code + PKCE)"| KC
    CAT -.->|"validation JWT (JWKS)"| KC
    ORD -.->|"validation JWT (JWKS)"| KC
    STK -.->|"validation JWT (JWKS)"| KC
    CAT -.->|"/actuator/prometheus"| PROM
    ORD -.-> PROM
    STK -.-> PROM
    MQ -.->|"profondeur des files, DLQ"| PROM
    PROM --> GRAF
    PROM -->|"6 règles d'alerte"| ALERT
```

## Principes
- Une base de données par service ; aucun accès direct aux données d'un autre service.
- Synchrone (REST, contrats OpenAPI) pour la lecture, asynchrone (RabbitMQ) pour la saga de commande.
- Chaque service est *resource server* OAuth2 : validation de la signature, de l'expiration et de l'audience du JWT.

## Mesures de sécurité par zone
| Zone | Mesures |
|---|---|
| Edge | Gateway API (Envoy Gateway, ADR-003) : TLS 1.2+ (cert-manager), validation du JWT et du rôle dès l'entrée (`SecurityPolicy`), rate limiting (`BackendTrafficPolicy`), en-têtes de sécurité (HSTS, CSP) |
| Applicative | JWT validé par service, rôles `CUSTOMER` / `MODERATOR` / `ADMIN`, images non root, limites CPU/mémoire |
| Données | Non exposée hors cluster, NetworkPolicies, secrets Kubernetes, migrations Flyway |
| Chaîne de livraison | gitleaks, SAST, SCA, scan d'images, DAST (voir `02-cicd-pipeline.md`) |
