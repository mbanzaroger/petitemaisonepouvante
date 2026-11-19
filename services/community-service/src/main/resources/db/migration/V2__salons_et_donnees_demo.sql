-- Salons de discussion thématiques et quelques annonces de démonstration publiées par des membres fictifs
-- (identifiants « demo-* », qui ne correspondent à aucun compte Keycloak).
INSERT INTO room (code, name, description, sort_order) VALUES
    ('general', 'Discussions générales', 'Présentez-vous et parlez de tout ce qui fait frissonner.', 1),
    ('films', 'Films et Blu-ray', 'Coups de cœur, éditions rares, restaurations et festivals.', 2),
    ('collection', 'Figurines et goodies', 'Vos collections, vos trouvailles et vos conseils d''exposition.', 3),
    ('jeux', 'Jeux, livres et BD', 'Jeux de société, romans et bandes dessinées d''épouvante.', 4);

INSERT INTO listing (id, owner_id, owner_name, type, title, description, category, item_condition, wanted, created_at, updated_at) VALUES
    ('5c0a0001-0000-4000-8000-000000000001', 'demo-lucie', 'lucie',
     'EXCHANGE', 'Affiche originale « La Nuit des masques »',
     'Affiche 40 x 60 cm de la ressortie en salle, jamais affichée, conservée à plat dans un carton à dessin.',
     'POSTERS', 'LIKE_NEW', 'Un Blu-ray collector d''un giallo des années 70', now() - interval '3 days', now() - interval '3 days'),
    ('5c0a0002-0000-4000-8000-000000000002', 'demo-hugo', 'hugo',
     'GIFT', 'Lot de magazines de cinéma fantastique',
     'Une vingtaine de numéros des années 90 : dossiers sur les effets spéciaux et entretiens. À récupérer sur Paris.',
     'BOOKS_COMICS', 'USED', NULL, now() - interval '2 days', now() - interval '2 days'),
    ('5c0a0003-0000-4000-8000-000000000003', 'demo-lucie', 'lucie',
     'EXCHANGE', 'Jeu « Cryptes et Lanternes » complet',
     'Joué deux fois, toutes les cartes sous protège-cartes. Idéal pour des soirées à quatre joueurs.',
     'BOARD_GAMES', 'LIKE_NEW', 'Une figurine de la boutique ou un autre jeu coopératif', now() - interval '1 day', now() - interval '1 day');

INSERT INTO message (room_code, author_id, author_name, content, sent_at) VALUES
    ('general', 'demo-equipe', 'équipe PME', 'Bienvenue dans l''espace communautaire ! Merci de respecter la charte : bienveillance, pas de vente déguisée, pas de données personnelles dans les salons.', now() - interval '4 days'),
    ('films', 'demo-hugo', 'hugo', 'Quelqu''un a vu la nouvelle restauration 4K ressortie ce mois-ci ? Les couleurs sont superbes.', now() - interval '1 day');
