-- Stock : quantités disponibles et réservées, verrou optimiste par version.
CREATE TABLE stock_item (
    product_id UUID    PRIMARY KEY,
    available  INTEGER NOT NULL CHECK (available >= 0),
    reserved   INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
    version    BIGINT  NOT NULL DEFAULT 0
);

CREATE TABLE stock_reservation (
    order_id   UUID        NOT NULL,
    product_id UUID        NOT NULL REFERENCES stock_item (product_id),
    quantity   INTEGER     NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (order_id, product_id)
);

-- Idempotence de la saga : un événement déjà traité n'est jamais rejoué.
CREATE TABLE processed_event (
    event_id     UUID        PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
