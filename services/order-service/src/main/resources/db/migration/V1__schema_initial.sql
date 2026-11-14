-- Commandes : l'identifiant client est le « subject » du jeton Keycloak.
CREATE TABLE customer_order (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id VARCHAR(64) NOT NULL,
    status      VARCHAR(16) NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED')),
    total_cents INTEGER     NOT NULL CHECK (total_cents >= 0),
    currency    CHAR(3)     NOT NULL DEFAULT 'EUR',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_customer ON customer_order (customer_id, created_at DESC);

CREATE TABLE order_line (
    order_id         UUID    NOT NULL REFERENCES customer_order (id) ON DELETE CASCADE,
    line_no          INTEGER NOT NULL,
    product_id       UUID    NOT NULL,
    quantity         INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
    PRIMARY KEY (order_id, line_no)
);
