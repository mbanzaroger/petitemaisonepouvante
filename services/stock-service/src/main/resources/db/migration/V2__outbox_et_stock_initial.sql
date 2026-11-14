-- Boîte d'envoi transactionnelle : résultats de réservation publiés ensuite vers RabbitMQ.
CREATE TABLE outbox_event (
    id             UUID        PRIMARY KEY,
    routing_key    VARCHAR(64) NOT NULL,
    payload        TEXT        NOT NULL,
    correlation_id VARCHAR(64),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at   TIMESTAMPTZ
);

CREATE INDEX idx_outbox_pending ON outbox_event (created_at) WHERE published_at IS NULL;

-- Stock initial des produits de démonstration (mêmes identifiants que catalog-service).
INSERT INTO stock_item (product_id, available) VALUES
    ('0f6c1a10-0001-4000-8000-000000000001', 25),
    ('0f6c1a10-0002-4000-8000-000000000002', 2),
    ('0f6c1a10-0003-4000-8000-000000000003', 40),
    ('0f6c1a10-0004-4000-8000-000000000004', 120),
    ('0f6c1a10-0005-4000-8000-000000000005', 60),
    ('0f6c1a10-0006-4000-8000-000000000006', 15),
    ('0f6c1a10-0007-4000-8000-000000000007', 80),
    ('0f6c1a10-0008-4000-8000-000000000008', 200),
    ('0f6c1a10-0009-4000-8000-000000000009', 150),
    ('0f6c1a10-0010-4000-8000-000000000010', 90),
    ('0f6c1a10-0011-4000-8000-000000000011', 300),
    ('0f6c1a10-0012-4000-8000-000000000012', 0);
