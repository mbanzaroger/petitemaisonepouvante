-- Images des produits (US21) : une image par produit, gardée en base avec le produit (ADR-007). Types limités aux
-- formats d'image matriciels courants ; 2 Mio au plus. L'empreinte SHA-256 sert d'ETag et de version d'URL.
CREATE TABLE product_image (
    product_id   UUID         PRIMARY KEY REFERENCES product (id) ON DELETE CASCADE,
    content_type VARCHAR(20)  NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
    data         BYTEA        NOT NULL,
    size_bytes   INTEGER      NOT NULL CHECK (size_bytes BETWEEN 1 AND 2097152),
    etag         CHAR(64)     NOT NULL,
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_by   VARCHAR(100) NOT NULL
);

-- Recherche (US22) : tri par nouveauté sans parcourir toute la table.
CREATE INDEX idx_product_created ON product (created_at DESC);
