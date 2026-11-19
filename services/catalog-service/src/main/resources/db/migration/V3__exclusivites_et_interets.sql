-- Gamme exclusive du collectif Evil Ed (figurines vendues uniquement sur le site).
ALTER TABLE product ADD COLUMN exclusive BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE product SET exclusive = TRUE WHERE sku IN ('FIG-ORC-001', 'FIG-ORC-002');

-- Recommandations (US13) : signaux d'intérêt d'un membre (consultation, recherche par catégorie, achat), enregistrés
-- uniquement avec son consentement (personalization.enabled) et conservés 90 jours.
CREATE TABLE personalization (
    member_id  VARCHAR(64) PRIMARY KEY,
    enabled    BOOLEAN     NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE interest_signal (
    id          BIGSERIAL   PRIMARY KEY,
    member_id   VARCHAR(64) NOT NULL,
    category_id BIGINT      NOT NULL REFERENCES category (id),
    product_id  UUID        REFERENCES product (id),
    kind        VARCHAR(10) NOT NULL CHECK (kind IN ('VIEW', 'SEARCH', 'PURCHASE')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_interest_member ON interest_signal (member_id, created_at DESC);
