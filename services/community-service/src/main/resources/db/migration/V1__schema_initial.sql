-- Espace communautaire : annonces de troc et de dons, propositions, salons et messages, notifications,
-- préférences, objets recherchés et signalements. Les membres sont identifiés par le « subject » Keycloak
-- (member_id, owner_id, author_id…) ; le nom affiché est copié au moment de l'action.

CREATE TABLE listing (
    id             UUID          PRIMARY KEY,
    owner_id       VARCHAR(64)   NOT NULL,
    owner_name     VARCHAR(100)  NOT NULL,
    type           VARCHAR(10)   NOT NULL CHECK (type IN ('EXCHANGE', 'GIFT')),
    title          VARCHAR(120)  NOT NULL,
    description    VARCHAR(2000) NOT NULL,
    category       VARCHAR(20)   NOT NULL,
    item_condition VARCHAR(10)   NOT NULL CHECK (item_condition IN ('NEW', 'LIKE_NEW', 'GOOD', 'USED')),
    wanted         VARCHAR(300),
    status         VARCHAR(10)   NOT NULL DEFAULT 'ACTIVE'
                   CHECK (status IN ('ACTIVE', 'CONCLUDED', 'WITHDRAWN', 'HIDDEN')),
    created_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_listing_active ON listing (status, created_at DESC);
CREATE INDEX idx_listing_owner ON listing (owner_id);

CREATE TABLE offer (
    id          UUID          PRIMARY KEY,
    listing_id  UUID          NOT NULL REFERENCES listing (id),
    author_id   VARCHAR(64)   NOT NULL,
    author_name VARCHAR(100)  NOT NULL,
    message     VARCHAR(1000) NOT NULL,
    status      VARCHAR(10)   NOT NULL DEFAULT 'PENDING'
                CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED')),
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_offer_listing ON offer (listing_id);
CREATE INDEX idx_offer_author ON offer (author_id);
-- Une seule proposition en attente par membre et par annonce (garantie en base, même en cas de requêtes concurrentes).
CREATE UNIQUE INDEX uq_offer_pending ON offer (listing_id, author_id) WHERE status = 'PENDING';

CREATE TABLE room (
    code        VARCHAR(30)  PRIMARY KEY,
    name        VARCHAR(80)  NOT NULL,
    description VARCHAR(200) NOT NULL,
    sort_order  INTEGER      NOT NULL
);

CREATE TABLE message (
    id          BIGSERIAL     PRIMARY KEY,
    room_code   VARCHAR(30)   REFERENCES room (code),
    offer_id    UUID          REFERENCES offer (id),
    author_id   VARCHAR(64)   NOT NULL,
    author_name VARCHAR(100)  NOT NULL,
    content     VARCHAR(1000) NOT NULL,
    hidden      BOOLEAN       NOT NULL DEFAULT FALSE,
    sent_at     TIMESTAMPTZ   NOT NULL DEFAULT now(),
    -- Un message appartient soit à un salon, soit à la conversation d'une proposition.
    CONSTRAINT message_channel CHECK ((room_code IS NULL) <> (offer_id IS NULL))
);
CREATE INDEX idx_message_room ON message (room_code, id) WHERE room_code IS NOT NULL;
CREATE INDEX idx_message_offer ON message (offer_id, id) WHERE offer_id IS NOT NULL;
CREATE INDEX idx_message_author_recent ON message (author_id, sent_at);

CREATE TABLE notification (
    id         BIGSERIAL    PRIMARY KEY,
    member_id  VARCHAR(64)  NOT NULL,
    type       VARCHAR(20)  NOT NULL,
    text       VARCHAR(300) NOT NULL,
    link       VARCHAR(200) NOT NULL,
    is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_notification_member ON notification (member_id, id DESC);

CREATE TABLE notification_preferences (
    member_id  VARCHAR(64) PRIMARY KEY,
    offers     BOOLEAN     NOT NULL DEFAULT TRUE,
    messages   BOOLEAN     NOT NULL DEFAULT TRUE,
    wishes     BOOLEAN     NOT NULL DEFAULT TRUE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE wish (
    id         UUID        PRIMARY KEY,
    member_id  VARCHAR(64) NOT NULL,
    keywords   VARCHAR(60) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX uq_wish_member_keywords ON wish (member_id, lower(keywords));

CREATE TABLE report (
    id            UUID         PRIMARY KEY,
    target_type   VARCHAR(10)  NOT NULL CHECK (target_type IN ('LISTING', 'MESSAGE')),
    target_id     VARCHAR(36)  NOT NULL,
    reporter_id   VARCHAR(64)  NOT NULL,
    reporter_name VARCHAR(100) NOT NULL,
    reason        VARCHAR(500) NOT NULL,
    status        VARCHAR(10)  NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'ACTIONED', 'DISMISSED')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    handled_by    VARCHAR(100),
    handled_at    TIMESTAMPTZ,
    CONSTRAINT uq_report_once UNIQUE (target_type, target_id, reporter_id)
);
CREATE INDEX idx_report_status ON report (status, created_at);
