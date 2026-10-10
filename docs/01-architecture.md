# Architecture technique et sécurité

```mermaid
flowchart TB
    U["Client (navigateur)"] -->|"HTTPS / TLS 1.2+"| ING

    subgraph K8S["Cluster Kubernetes (hébergement UE)"]
        direction TB
        subgraph EDGE["Zone exposée"]
            ING["Ingress NGINX<br/>cert-manager + rate limiting"]
            FE["web-frontend (SPA)"]
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
        end
    end

    ING --> FE
    ING -->|"REST /api/v1/products"| CAT
    ING -->|"REST /api/v1/orders + JWT"| ORD
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
    PROM --> GRAF
```

## Principes
- Une base de données par service ; aucun accès direct aux données d'un autre service.
- Synchrone (REST, contrats OpenAPI) pour la lecture, asynchrone (RabbitMQ) pour la saga de commande.
- Chaque service est *resource server* OAuth2 : validation de la signature, de l'expiration et de l'audience du JWT.

## Mesures de sécurité par zone
| Zone | Mesures |
|---|---|
| Edge | TLS (cert-manager), rate limiting, en-têtes de sécurité (HSTS, CSP) |
| Applicative | JWT validé par service, rôles `CUSTOMER` / `MODERATOR` / `ADMIN`, images non root, limites CPU/mémoire |
| Données | Non exposée hors cluster, NetworkPolicies, secrets Kubernetes, migrations Flyway |
| Chaîne de livraison | gitleaks, SAST, SCA, scan d'images, DAST (voir `02-cicd-pipeline.md`) |
