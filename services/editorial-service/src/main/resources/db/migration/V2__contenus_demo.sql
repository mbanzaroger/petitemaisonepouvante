-- Contenus de démonstration (textes originaux, fictifs) : actualités, articles de fond et trois numéros du fanzine.

INSERT INTO article (id, slug, kind, title, summary, body, author, published_at) VALUES
('a7c10001-0000-4000-8000-000000000001', 'la-gamme-evil-ed-arrive-en-exclusivite', 'NEWS',
 'La gamme Evil Ed arrive en exclusivité sur le site',
 'Le collectif Evil Ed confie à la boutique la vente exclusive de sa première série de figurines, inspirée de la web série L''Orc.',
 'Après deux saisons de la web série L''Orc, le collectif Evil Ed franchit le pas : sa première série de figurines sera vendue uniquement sur notre site.

La figurine de l''Orc, en résine peinte et numérotée, ouvre la collection. Un buste peint à la main l''accompagne, en tirage limité.

Les précommandes ne sont pas nécessaires : le stock est suivi en direct et chaque commande est confirmée en quelques secondes. Rendez-vous dans le catalogue, filtre « Exclusivités Evil Ed ».',
 'équipe PME', now() - interval '2 days'),
('a7c10002-0000-4000-8000-000000000002', 'le-petit-festival-ouvre-sa-billetterie', 'NEWS',
 'Le Petit Festival de l''Épouvante ouvre sa sélection',
 'Courts métrages, nuit blanche et rencontres : la sélection de la prochaine édition sera dévoilée sur le site.',
 'Le Petit Festival de l''Épouvante revient pour une nouvelle édition. Le comité de sélection a visionné plus de deux cents courts métrages venus de toute l''Europe.

Comme chaque année, une nuit blanche clôturera le festival, et le coffret Blu-ray des cinq courts métrages primés l''an dernier est disponible dans la boutique.

Les membres de l''espace communautaire pourront échanger leurs impressions dans le salon « Films et Blu-ray ».',
 'équipe PME', now() - interval '6 days'),
('a7c10003-0000-4000-8000-000000000003', 'pourquoi-les-couleurs-du-giallo-nous-hantent', 'FEATURE',
 'Pourquoi les couleurs du giallo nous hantent encore',
 'Rouges saturés, verts acides, bleus de nuit : retour sur une grammaire visuelle qui continue d''inspirer affiches, clips et jeux vidéo.',
 'Le giallo est souvent réduit à ses intrigues criminelles. Pourtant, ce qui reste en mémoire, ce sont d''abord ses couleurs : une lumière de vitrail posée sur des couloirs d''hôtel, des imperméables vernis sous la pluie, des intérieurs où chaque objet semble éclairé par une autre source.

Cette esthétique répondait à une contrainte très concrète : tourner vite, avec peu de moyens, des films qui devaient frapper au premier regard sur une affiche ou une bande-annonce. La couleur faisait office de décor.

Les restaurations récentes en haute définition ont rendu à ces images leur éclat. Elles posent aussi une question de fidélité : faut-il retrouver le grain de la copie d''époque, ou la couleur rêvée par le chef opérateur ?

Notre conseil de lecture : regardez une scène deux fois, la seconde sans le son. La mise en scène se lit alors comme une partition de couleurs.',
 'rédaction du fanzine', now() - interval '10 days'),
('a7c10004-0000-4000-8000-000000000004', 'collectionner-les-figurines-sans-se-ruiner', 'FEATURE',
 'Collectionner les figurines sans se ruiner',
 'Conseils d''exposition, d''entretien et d''échange pour faire vivre une collection, de la vitrine au troc entre passionnés.',
 'Une collection commence souvent par un coup de cœur, puis par une étagère qui déborde. Quelques principes simples évitent les déceptions.

Exposez à l''abri de la lumière directe : les ultraviolets ternissent la peinture des résines. Une vitrine fermée limite aussi la poussière, ennemie des détails fins.

Pour les pièces numérotées, conservez boîte et certificat : ils comptent autant que la figurine au moment d''un échange.

Enfin, n''oubliez pas l''espace communautaire du site : un doublon peut devenir la pièce manquante d''un autre collectionneur. Le troc y est gratuit et modéré.',
 'rédaction du fanzine', now() - interval '20 days');

INSERT INTO issue (number, title, summary, published_on, price_cents) VALUES
(35, 'Numéro 35 — Les maisons qui respirent', 'Dossier sur les maisons hantées au cinéma, entretien avec une décoratrice de plateau et sélection de lectures d''automne.', DATE '2026-03-01', 390),
(36, 'Numéro 36 — Monstres faits main', 'Les effets spéciaux artisanaux à l''heure du numérique : maquillages, marionnettes et maquettes.', DATE '2026-06-01', 390),
(37, 'Numéro 37 — Spécial cinéma d''horreur italien', 'Giallo, gothique et fantastique transalpin : un dossier de fond, des chroniques de restaurations et un lexique.', DATE '2026-09-01', 390);

INSERT INTO issue_page (issue_number, page_no, title, content) VALUES
(35, 1, 'Édito', 'Une maison hantée n''est jamais seulement un décor. C''est un personnage qui respire, craque, se souvient.

Dans ce numéro, nous visitons ces demeures de cinéma où les murs semblent écouter, et nous rencontrons celles et ceux qui les construisent.'),
(35, 2, 'Dossier : la maison comme personnage', 'Le cinéma fantastique a très tôt compris qu''un couloir trop long ou une porte entrouverte valaient toutes les apparitions.

Les plus belles maisons hantées sont celles que l''on parcourt avec les personnages, pièce après pièce, jusqu''à en connaître le plan mieux que le sien.'),
(35, 3, 'Entretien : construire l''inquiétude', 'Une décoratrice de plateau raconte comment on vieillit un papier peint en une nuit, et pourquoi un meuble légèrement trop grand suffit à mettre mal à l''aise.

« Le spectateur ne doit jamais savoir ce qui le gêne. Il doit seulement avoir envie de sortir de la pièce. »'),
(35, 4, 'Lectures d''automne', 'Trois romans à lire sous une couverture, une bande dessinée en noir et blanc et un recueil de nouvelles à partager à voix haute.

Bonne lecture, et rendez-vous au prochain numéro.'),
(36, 1, 'Édito', 'Le latex, la mousse, le fil de fer et la patience : ce numéro rend hommage aux monstres faits main.

À l''heure des images de synthèse, l''artisanat garde une présence que l''œil reconnaît immédiatement.'),
(36, 2, 'Dossier : la main derrière le monstre', 'Une créature réussie est d''abord une créature qui pèse. On sent son poids, la résistance de sa peau, l''effort de ceux qui l''animent hors champ.

Nous revenons sur les grandes familles d''effets artisanaux : maquillages prothétiques, animatroniques, marionnettes à tiges et maquettes.'),
(36, 3, 'Atelier : vieillir une figurine', 'Lavis sombre dans les creux, brossage à sec sur les reliefs, touche de vernis satiné sur les yeux : trois étapes pour donner du caractère à une figurine de série.

Travaillez toujours du plus sombre au plus clair, et laissez sécher entre chaque couche.'),
(36, 4, 'Courrier des lecteurs', 'Vos questions sur l''entretien des collections, vos souvenirs de festivals et une proposition d''échange de magazines anciens, à retrouver dans l''espace communautaire.'),
(37, 1, 'Édito', 'L''Italie a offert au cinéma de genre certaines de ses images les plus vives. Ce numéro spécial leur est consacré.

Nous avons choisi de parler de couleurs, de musique et de restauration plutôt que de palmarès.'),
(37, 2, 'Dossier : les trois visages du fantastique italien', 'Le gothique en noir et blanc, peuplé de châteaux et de portraits ; le giallo, urbain et coloré ; le fantastique onirique, où la logique du rêve remplace celle de l''enquête.

Ces trois veines se croisent souvent dans la filmographie d''un même cinéaste.'),
(37, 3, 'Restaurations : ce qui change en haute définition', 'Une restauration réussie ne se contente pas d''enlever les rayures. Elle retrouve les couleurs d''origine, la profondeur des noirs, et parfois des plans coupés lors de l''exploitation en salle.

Le Blu-ray restauré disponible dans la boutique propose ainsi la version originale sous-titrée et un livret de vingt-quatre pages.'),
(37, 4, 'Lexique du fan', 'Giallo : couverture jaune des romans policiers italiens, devenue le nom d''un genre.

Gothique : récit fantastique en costumes, souvent situé dans un passé lointain.

Restauration 4K : numérisation et nettoyage de la pellicule à très haute résolution.');
