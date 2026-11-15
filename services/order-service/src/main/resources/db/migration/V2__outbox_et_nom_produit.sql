-- Nom du produit figé au moment de la commande (historique lisible même si le catalogue change).
ALTER TABLE order_line ADD COLUMN product_name VARCHAR(200) NOT NULL DEFAULT '';

-- Boîte d'envoi transactionnelle : événements écrits avec la commande, publiés ensuite vers RabbitMQ.
CREATE TABLE outbox_event (
    id             UUID        PRIMARY KEY,
    routing_key    VARCHAR(64) NOT NULL,
    payload        TEXT        NOT NULL,
    correlation_id VARCHAR(64),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at   TIMESTAMPTZ
);

CREATE INDEX idx_outbox_pending ON outbox_event (created_at) WHERE published_at IS NULL;
