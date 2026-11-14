-- Catalogue : catégories et produits (prix en centimes pour éviter les erreurs d'arrondi).
CREATE TABLE category (
    id          BIGSERIAL    PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE product (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    sku         VARCHAR(40)  NOT NULL UNIQUE,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    price_cents INTEGER      NOT NULL CHECK (price_cents >= 0),
    currency    CHAR(3)      NOT NULL DEFAULT 'EUR',
    category_id BIGINT       REFERENCES category (id),
    active      BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_category ON product (category_id);
