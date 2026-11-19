-- Éditions : articles (actualités et articles de fond), fanzine numérique (numéros, pages, achats, progression de
-- lecture) et abonnements. Les membres sont identifiés par le « subject » Keycloak.

CREATE TABLE article (
    id           UUID         PRIMARY KEY,
    slug         VARCHAR(90)  NOT NULL UNIQUE,
    kind         VARCHAR(10)  NOT NULL CHECK (kind IN ('NEWS', 'FEATURE')),
    title        VARCHAR(160) NOT NULL,
    summary      VARCHAR(300) NOT NULL,
    body         TEXT         NOT NULL CHECK (length(body) <= 20000),
    author       VARCHAR(100) NOT NULL,
    published    BOOLEAN      NOT NULL DEFAULT TRUE,
    published_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_article_published ON article (published, published_at DESC);

CREATE TABLE issue (
    number       INTEGER      PRIMARY KEY,
    title        VARCHAR(160) NOT NULL,
    summary      VARCHAR(400) NOT NULL,
    published_on DATE         NOT NULL,
    price_cents  INTEGER      NOT NULL CHECK (price_cents >= 0)
);

CREATE TABLE issue_page (
    issue_number INTEGER      NOT NULL REFERENCES issue (number),
    page_no      INTEGER      NOT NULL CHECK (page_no >= 1),
    title        VARCHAR(160) NOT NULL,
    content      TEXT         NOT NULL,
    PRIMARY KEY (issue_number, page_no)
);

-- Numéros achetés (paiement simulé dans le démonstrateur).
CREATE TABLE entitlement (
    member_id    VARCHAR(64) NOT NULL,
    issue_number INTEGER     NOT NULL REFERENCES issue (number),
    price_cents  INTEGER     NOT NULL,
    purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (member_id, issue_number)
);

CREATE TABLE reading_progress (
    member_id    VARCHAR(64) NOT NULL,
    issue_number INTEGER     NOT NULL REFERENCES issue (number),
    page_no      INTEGER     NOT NULL,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (member_id, issue_number)
);

-- Un abonnement par membre, prolongé à chaque renouvellement ; adresse vide pour la formule numérique.
CREATE TABLE subscription (
    id          UUID         PRIMARY KEY,
    member_id   VARCHAR(64)  NOT NULL UNIQUE,
    member_name VARCHAR(100) NOT NULL,
    plan        VARCHAR(15)  NOT NULL CHECK (plan IN ('DIGITAL', 'PAPER_DIGITAL')),
    starts_on   DATE         NOT NULL,
    ends_on     DATE         NOT NULL,
    recipient   VARCHAR(100) NOT NULL DEFAULT '',
    street      VARCHAR(200) NOT NULL DEFAULT '',
    postal_code VARCHAR(10)  NOT NULL DEFAULT '',
    city        VARCHAR(100) NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CHECK (ends_on >= starts_on)
);
CREATE INDEX idx_subscription_paper ON subscription (plan, ends_on);

-- Historique des souscriptions et renouvellements (montants simulés).
CREATE TABLE subscription_event (
    id           BIGSERIAL   PRIMARY KEY,
    member_id    VARCHAR(64) NOT NULL,
    event        VARCHAR(10) NOT NULL CHECK (event IN ('NEW', 'RENEWAL')),
    plan         VARCHAR(15) NOT NULL,
    amount_cents INTEGER     NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
