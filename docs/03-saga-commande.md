# Saga de commande (chorégraphie)

```mermaid
sequenceDiagram
    autonumber
    actor C as Client
    participant ING as Ingress
    participant O as order-service
    participant CAT as catalog-service
    participant MQ as RabbitMQ
    participant S as stock-service

    C->>ING: POST /api/v1/orders (JWT CUSTOMER)
    ING->>O: requête (TLS terminé)
    O->>O: validation du JWT et des rôles
    O->>CAT: GET prix et disponibilité
    CAT-->>O: produits valides
    O->>O: création commande (PENDING)
    O->>MQ: publie OrderPlaced (eventId, orderId, lignes)
    O-->>C: 202 Accepted (orderId)
    MQ->>S: OrderPlaced
    S->>S: déduplication par eventId (idempotence)
    alt stock suffisant
        S->>S: réservation du stock
        S->>MQ: StockReserved
        MQ->>O: StockReserved
        O->>O: statut CONFIRMED
    else stock insuffisant
        S->>MQ: StockRejected
        MQ->>O: StockRejected
        O->>O: statut CANCELLED
    end
    Note over MQ,S: échec répété : file de rebut (dead-letter queue)
```

## Garanties visées
- **Idempotence** : un même `eventId` rejoué ne décrémente le stock qu'une seule fois.
- **Fiabilité** : files durables, accusés de réception manuels, temporisation des nouvelles tentatives, dead-letter queue.
- **Traçabilité** : `correlationId` propagé de l'Ingress aux événements et aux logs.
