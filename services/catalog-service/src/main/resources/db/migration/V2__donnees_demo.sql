-- Jeu de données de démonstration (produits fictifs du cas La Petite Maison de l'Épouvante).
-- Les identifiants sont fixes : stock-service initialise son stock avec les mêmes.
INSERT INTO category (name) VALUES
    ('Figurines'), ('Blu-ray'), ('Jeux de société'), ('Goodies'), ('Bandes dessinées'), ('Fanzine');

INSERT INTO product (id, sku, name, description, price_cents, category_id, active) VALUES
    ('0f6c1a10-0001-4000-8000-000000000001', 'FIG-ORC-001', 'Figurine L''Orc — édition limitée Evil Ed',
     'Résine peinte, 22 cm, numérotée. Exclusivité du site.', 5990, (SELECT id FROM category WHERE name = 'Figurines'), TRUE),
    ('0f6c1a10-0002-4000-8000-000000000002', 'FIG-ORC-002', 'Buste de L''Orc peint à la main',
     'Buste 1/4, socle en bois, certificat d''authenticité.', 12900, (SELECT id FROM category WHERE name = 'Figurines'), TRUE),
    ('0f6c1a10-0003-4000-8000-000000000003', 'FIG-SPC-003', 'Figurine Le Spectre du Manoir',
     'Figurine phosphorescente, 15 cm.', 3490, (SELECT id FROM category WHERE name = 'Figurines'), TRUE),
    ('0f6c1a10-0004-4000-8000-000000000004', 'BR-RIF-001', 'Riflesso di un coltello nella notte — Blu-ray restauré',
     'Restauration 4K, version originale sous-titrée, livret de 24 pages.', 2490, (SELECT id FROM category WHERE name = 'Blu-ray'), TRUE),
    ('0f6c1a10-0005-4000-8000-000000000005', 'BR-FES-002', 'Coffret Petit Festival de l''Épouvante — 5 courts métrages',
     'Sélection officielle du festival, bonus et entretiens.', 3990, (SELECT id FROM category WHERE name = 'Blu-ray'), TRUE),
    ('0f6c1a10-0006-4000-8000-000000000006', 'JDS-MAN-001', 'Le Manoir des Ombres — jeu de plateau coopératif',
     '2 à 5 joueurs, 60 minutes, dès 14 ans.', 4490, (SELECT id FROM category WHERE name = 'Jeux de société'), TRUE),
    ('0f6c1a10-0007-4000-8000-000000000007', 'JDS-CRY-002', 'Cryptes et Lanternes — jeu de cartes',
     '110 cartes illustrées, 2 à 4 joueurs.', 1990, (SELECT id FROM category WHERE name = 'Jeux de société'), TRUE),
    ('0f6c1a10-0008-4000-8000-000000000008', 'GOO-MUG-001', 'Mug « Le lieu de rêve pour frissonner »',
     'Céramique 33 cl, compatible lave-vaisselle.', 1290, (SELECT id FROM category WHERE name = 'Goodies'), TRUE),
    ('0f6c1a10-0009-4000-8000-000000000009', 'GOO-TSH-002', 'T-shirt Petit Festival de l''Épouvante 2026',
     'Coton biologique, tailles S à XXL.', 2490, (SELECT id FROM category WHERE name = 'Goodies'), TRUE),
    ('0f6c1a10-0010-4000-8000-000000000010', 'BD-ORC-001', 'L''Orc — tome 1 (bande dessinée)',
     'Album cartonné, 64 pages, dans l''univers de la web série.', 1995, (SELECT id FROM category WHERE name = 'Bandes dessinées'), TRUE),
    ('0f6c1a10-0011-4000-8000-000000000011', 'FZ-037-001', 'Fanzine La Petite Maison — numéro 37 (papier)',
     'Dossier spécial cinéma d''horreur italien.', 690, (SELECT id FROM category WHERE name = 'Fanzine'), TRUE),
    ('0f6c1a10-0012-4000-8000-000000000012', 'GOO-AFF-003', 'Affiche sérigraphiée L''Orc (épuisée)',
     'Tirage limité à 200 exemplaires.', 2990, (SELECT id FROM category WHERE name = 'Goodies'), FALSE);
