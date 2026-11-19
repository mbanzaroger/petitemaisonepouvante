-- US19 : nom affiché du client (preferred_username du jeton) conservé avec la commande pour le suivi par
-- l'administrateur ; vide pour les commandes antérieures. Index de la liste d'administration (récentes d'abord).
ALTER TABLE customer_order ADD COLUMN customer_name VARCHAR(100);

CREATE INDEX idx_order_status_created ON customer_order (status, created_at DESC);
CREATE INDEX idx_order_created ON customer_order (created_at DESC);
