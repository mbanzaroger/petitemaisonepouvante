# ADR-007 — Images des produits gardées par le catalogue, refonte de l'interface du site

- **Statut** : accepté (20/11/2026)
- **Contexte** : à la recette du 20/11/2026, le Lead Dev valide les fonctions du site et demande une interface plus proche d'une boutique en ligne, à partir d'un gabarit de référence (en-tête rouge avec recherche, barre de rayons jaune, colonne de filtres, cartes avec image, pied de page sombre) : chaque produit doit avoir une image, et l'administrateur doit pouvoir l'ajouter quand il met un produit en vente. Aucune fonction existante ne doit disparaître.

  Contraintes : sécurité forte (plateforme commerciale), hébergement en Europe (ADR-006), RGAA, CSP stricte du site (aucune ressource tierce), budget de poids du premier affichage (110 Ko gzip), POC sans nouvelle brique d'infrastructure si possible.

## Décision 1 — où garder les images

| Option | Pour | Contre |
|---|---|---|
| Fichiers dans l'image du site | Aucun code serveur | L'administrateur ne peut rien ajouter sans nouvelle livraison |
| Volume partagé monté dans `catalog-service` | Simple | Volume `ReadWriteMany` à gérer, sauvegarde séparée de la base, réplicas multiples délicats |
| Stockage objet compatible S3 (MinIO en local, service managé dans l'UE en production) | Adapté aux gros volumes, CDN possible | Nouvelle brique et nouveaux secrets dans le POC, accès signé ou public à gérer |
| **Base PostgreSQL du catalogue (`product_image`, `bytea`)** | Aucune nouvelle brique ; une image suit son produit (transaction, sauvegarde, PRA de la base) ; droits déjà en place (rôle `ADMIN`) | Base plus lourde ; servie par le service (pas de CDN direct) |

**Choix** : table `product_image` dans la base du catalogue, une image par produit, **2 Mio au plus**, formats **JPEG, PNG et WebP** uniquement. Volume attendu : quelques centaines de produits × 50 à 500 Kio, soit moins de 300 Mio, sans effet notable sur PostgreSQL. **Réexamen** au-delà de 5 000 produits ou si plusieurs images par produit sont demandées : stockage objet dans l'UE derrière le même contrat d'API (`imageUrl`), sans changement du site.

## Décision 2 — contrat et sécurité

- **Lecture publique** : `GET /api/v1/products/{id}/image`. Le produit porte `imageUrl`, adresse **versionnée** (`?v=` + 16 premiers caractères du SHA-256) : réponse mise en cache un an (`immutable`), une nouvelle image change l'adresse. Sans version ou avec une version périmée, revalidation par `ETag` (304).
- **Écriture `ADMIN`** : `PUT /api/v1/catalog/admin/products/{id}/image` (corps binaire, type de l'image) et `DELETE` du même chemin. Rôle exigé au Gateway (`SecurityPolicy` de `catalog-admin`) **et** dans le service ; chaque écriture est journalisée avec son auteur.
- **Contrôle du contenu** : type annoncé limité aux trois formats (sinon 415), **signature du fichier** vérifiée et cohérente avec le type annoncé (un HTML ou un SVG renommé est refusé, 415), lecture interrompue au-delà de 2 Mio (413) ; le relais nginx local et le service appliquent la même limite. SVG refusé : il peut contenir du script.
- **Service des images** : type exact, `X-Content-Type-Options: nosniff`, `Content-Security-Policy: default-src 'none'; sandbox` : même ouverte directement, une image ne peut exécuter aucun script.
- **CSP du site** : `img-src 'self' blob:` ; `blob:` sert uniquement à l'aperçu local de l'image choisie par l'administrateur, avant envoi.
- **Images de démonstration** : visuels originaux dessinés pour le projet (`scripts/images-demo`), chargés par une migration Flyway Java (`V5__images_de_demonstration`) ; aucune image tierce ni photo de personne.

## Décision 3 — interface

- Gabarit repris du modèle sans son identité : bandeau, en-tête rouge (logo de la boutique, recherche avec choix du rayon, compte, panier), barre jaune « Toutes les catégories » (menu dépliant), navigation principale, liens d'administration sur une barre dédiée, pied de page sombre (à propos, boutique, communauté, informations légales, magasins d'Angoulême, d'Aix-en-Provence, de Lyon et de Londres).
- Catalogue : fil d'Ariane, colonne des rayons et des filtres, bandeau du rayon, affichage en grille ou en liste (préférence gardée dans le navigateur), tri (nom, prix croissant ou décroissant, nouveautés), cartes avec image ; recherche plein texte côté serveur (nom, description, référence, sans majuscules ni accents).
- Seules les fonctions qui existent sont représentées : ni notes d'avis, ni liste d'envies, ni comparateur, ni promotion fictive.
- RGAA : noms accessibles inchangés pour les parcours existants, motif de divulgation pour le menu des rayons (`aria-expanded`, Échap), boutons d'affichage `aria-pressed`, images décoratives dans les cartes (`alt=""`, le nom est à côté) et texte de remplacement sur la fiche, contrastes vérifiés (texte ≥ 4,5:1, focus jaune sur fond rouge ou sombre).
- Performance : dimensions des images déclarées (pas de décalage), chargement différé hors des premières cartes ; fiche produit et panier chargés à la demande pour que le premier affichage reste sous 110 Ko.

## Conséquences

- Nouvelles US21 (images) et US22 (recherche et tri) au backlog (épic 6) ; tests d'intégration du catalogue (`ProductImageApiIT`, recherche et tri dans `ProductApiIT`), Vitest, parcours Playwright avec envoi d'une image, contrôles de fumée.
- Risque résiduel enregistré (`docs/13`, V-30) : les images ne sont pas ré-encodées (métadonnées conservées) ; action R-14 au plan de remédiation.
