# Architecture technique et sécurité

```mermaid
flowchart TB
    U["Client (navigateur)"] -->|"HTTPS / TLS 1.2+"| ING

    subgraph K8S["Cluster Kubernetes (hébergement UE)"]
        direction TB
        subgraph EDGE["Zone exposée"]
            ING["Gateway API — Envoy Gateway<br/>TLS cert-manager, JWT + rôles, rate limiting"]
            FE["web-frontend : SPA React<br/>nginx non root, CSP stricte — ADR-002"]
        end
        subgraph APP["Zone applicative (NetworkPolicies deny-all par défaut)"]
            CAT["catalog-service<br/>Spring Boot"]
            ORD["order-service<br/>Spring Boot"]
            STK["stock-service<br/>Spring Boot"]
            COM["community-service<br/>troc, dons, salons, modération — ADR-004"]
            EDI["editorial-service<br/>actualités, fanzine, abonnements — ADR-006"]
            KC["Keycloak<br/>OIDC / JWT"]
        end
        subgraph DATA["Zone données (non exposée)"]
            DBC[("PostgreSQL catalog")]
            DBO[("PostgreSQL orders")]
            DBS[("PostgreSQL stock")]
            DBM[("PostgreSQL community")]
            DBE[("PostgreSQL editorial")]
            MQ{{"RabbitMQ"}}
        end
        subgraph OBS["Observabilité"]
            PROM["Prometheus"]
            GRAF["Grafana"]
            ALERT["Alertmanager"]
        end
    end

    ING -->|"app.pme.local : site"| FE
    ING -->|"REST /api/v1/products"| CAT
    ING -->|"REST /api/v1/orders + JWT vérifié"| ORD
    ING -->|"REST /api/v1/community : annonces publiques,<br/>reste membres (JWT), modération ADMIN"| COM
    ING -->|"REST /api/v1/editorial : lecture publique,<br/>achats et abonnement (JWT), rédaction ADMIN"| EDI
    ORD -->|"REST : prix et disponibilité"| CAT
    ORD -->|"événement OrderPlaced"| MQ
    MQ -->|"OrderPlaced"| STK
    STK -->|"StockReserved / StockRejected"| MQ
    MQ -->|"résultat de réservation"| ORD
    CAT --- DBC
    ORD --- DBO
    STK --- DBS
    COM --- DBM
    EDI --- DBE
    U -.->|"OIDC code + PKCE S256<br/>(redirection, jetons en mémoire)"| KC
    CAT -.->|"validation JWT (JWKS)"| KC
    ORD -.->|"validation JWT (JWKS)"| KC
    STK -.->|"validation JWT (JWKS)"| KC
    COM -.->|"validation JWT (JWKS)"| KC
    EDI -.->|"validation JWT (JWKS)"| KC
    CAT -.->|"/actuator/prometheus"| PROM
    ORD -.-> PROM
    STK -.-> PROM
    COM -.-> PROM
    EDI -.-> PROM
    MQ -.->|"profondeur des files, DLQ"| PROM
    PROM --> GRAF
    PROM -->|"7 règles d'alerte"| ALERT
```

## Principes
- Une base de données par service ; aucun accès direct aux données d'un autre service.
- Le site (`web-frontend`) n'est qu'un ensemble de fichiers statiques : le navigateur appelle l'API **sur la même origine** (`app.pme.local`), le Gateway route `/api/v1/*` vers les services et tout le reste vers nginx. Le site n'a aucun flux sortant (NetworkPolicy).
- Synchrone (REST, contrats OpenAPI) pour la lecture, asynchrone (RabbitMQ) pour la saga de commande.
- Chaque service est *resource server* OAuth2 : validation de la signature, de l'expiration et de l'audience du JWT.
- L'espace communautaire (troc, dons, salons, notifications, modération) est un service à part entière, `community-service`, avec sa base : son modèle (annonces, propositions, messages) et sa charge (relevés fréquents des discussions) sont indépendants de la vente, et il ne dépend d'aucun autre service (ADR-004). Les discussions sont relevées périodiquement par le navigateur, sans connexion persistante (ADR-005).
- Administration de la boutique (US18, US19) : gestion des produits dans le catalogue (`/api/v1/catalog/admin`), réapprovisionnement et inventaire dans le stock, suivi des commandes de tous les clients dans le service des commandes (`/api/v1/orders/admin`) ; rôle `ADMIN` exigé au Gateway et dans chaque service. Inscription des clients (US20) par Keycloak : rôle `CUSTOMER` attribué par défaut, le site ne voit jamais le mot de passe.
- Les contenus éditoriaux (actualités, articles de fond, fanzine numérique, abonnements) forment un cinquième service, `editorial-service`, sans stock ni saga : le droit de lecture est vérifié à chaque page servie, sans fichier téléchargeable (ADR-006).
- Hébergement en Europe : cluster Kubernetes managé d'un fournisseur européen (région France), bases managées chiffrées avec sauvegardes dans une seconde région de l'UE, registre d'images et supervision dans le même périmètre ; la CI ne manipule que des données fictives ; aucune ressource tierce chargée par le site (ADR-006, décision 2).
- Évolutions prévues : enchères et diffusion des productions Evil Ed (v2), projections en ligne du festival à jauge et horaires fixes (v3), chacune dans un service dédié (ADR-006, décision 3).

## Mesures de sécurité par zone
| Zone | Mesures |
|---|---|
| Edge | Gateway API (Envoy Gateway, ADR-003) : TLS 1.2+ (cert-manager), validation du JWT et du rôle dès l'entrée (`SecurityPolicy`), rate limiting (`BackendTrafficPolicy`), HSTS et CORP ajoutés aux réponses |
| Site (navigateur) | CSP stricte posée par nginx (aucun script ni style en ligne, `frame-ancestors 'none'`), jetons en mémoire, même origine que l'API (ni CORS ni cookie), aucune ressource tierce ; conteneur nginx non root en lecture seule |
| Applicative | JWT validé par service, rôles `CUSTOMER` / `ADMIN` (la modération de l'espace communautaire est confiée à `ADMIN`), images non root, limites CPU/mémoire ; espace communautaire : anti-flood par membre, propositions visibles de leurs seuls participants, identifiants des membres jamais exposés ; éditions : droit de lecture vérifié à chaque page du fanzine, rédaction et liste d'expédition réservées à `ADMIN`, contenus en texte brut (aucun HTML interprété) |
| Données | Non exposée hors cluster, NetworkPolicies (chaque base n'accepte que son service), secrets Kubernetes, migrations Flyway ; durées de conservation appliquées par les services (notifications lues 90 jours, messages de salon 365 jours, adresses de livraison du fanzine 90 jours après l'échéance) |
| Chaîne de livraison | gitleaks, SAST, SCA, scan d'images, DAST (voir `02-cicd-pipeline.md`) |
