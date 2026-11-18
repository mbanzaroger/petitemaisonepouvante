-- Notifications selon le comportement de navigation (US14) : catégories d'annonces consultées par un membre qui l'a
-- accepté (préférence « browsing », désactivée par défaut). Scores conservés 180 jours sans nouvelle consultation.
ALTER TABLE notification_preferences ADD COLUMN browsing BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE member_interest (
    member_id  VARCHAR(64) NOT NULL,
    category   VARCHAR(20) NOT NULL,
    score      INTEGER     NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (member_id, category)
);
CREATE INDEX idx_member_interest_category ON member_interest (category, score);
