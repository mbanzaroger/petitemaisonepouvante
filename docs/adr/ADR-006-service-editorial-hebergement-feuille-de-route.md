# ADR-006 — Un service éditorial (actualités, fanzine numérique, abonnements), l'hébergement en Europe et la feuille de route v2/v3

- **Statut** : accepté (19/11/2026)
- **Contexte** : les exigences de petitemaisonepouvante.com ajoutent à la boutique et à l'espace communautaire :
  - des actualités régulières et des articles de fond ouverts à tous les visiteurs ;
  - les anciens numéros du fanzine, numérisés, lisibles dans une liseuse intégrée à l'espace de l'utilisateur authentifié ;
  - un abonnement au fanzine (papier et numérique, ou numérique seul) et son renouvellement ;
  - un hébergement en Europe et une sécurité renforcée ;
  - plus tard, des enchères (v2), la diffusion des productions d'Evil Ed (v2) et, peut-être, la projection en ligne des films du festival avec places limitées et horaires fixes (v3).

  Ces contenus n'ont ni stock ni saga de commande : un numéro numérique se vend sans limite, un abonnement est un droit daté. Leur charge (lecture de pages, consultation d'articles) et leurs données (adresse de livraison du fanzine papier) sont propres.

## Décision 1 — `editorial-service`

Un cinquième microservice, `editorial-service` (Spring Boot 4.1, PostgreSQL `editorial`, Flyway), exposé sous `/api/v1/editorial/*` :

- **Actualités et articles (US15)** : `NEWS` ou `FEATURE`, texte brut (paragraphes séparés par une ligne vide) affiché comme texte par React : aucun HTML stocké ni interprété, donc pas de XSS stockée ; adresse lisible dérivée du titre ; publication et retrait réservés à `ADMIN`.
- **Fanzine numérique (US16)** : chaque numéro est découpé en pages de texte servies **une à une** par l'API, le droit de lecture étant vérifié à chaque page (page 1 en extrait libre, la suite exige un achat ou un abonnement en cours). Aucun fichier téléchargeable, aucune URL de PDF à partager ; la page atteinte est mémorisée (« Reprendre la lecture »). Du vrai texte plutôt que des images de pages : agrandissement, lecteur d'écran et navigation au clavier (RGAA).
- **Abonnement (US17)** : un an, `DIGITAL` ou `PAPER_DIGITAL` ; renouvellement ouvert 60 jours avant l'échéance (ou après), sans chevauchement ; adresse de livraison exigée pour le papier seulement, visible du seul membre et de la liste d'expédition `ADMIN`, effacée 90 jours après l'échéance.
- **Paiement** : simulé dans le POC, comme pour les commandes ; en production, prestataire de paiement établi dans l'UE (PCI DSS, 3-D Secure), le service ne voyant jamais de numéro de carte.
- **Accès** : routes publiques en lecture (articles, numéros, formules, pages dont l'accès est décidé par le service), routes membres (achat, bibliothèque, abonnement) avec JWT exigé au Gateway, routes `/admin/*` avec rôle `ADMIN` au Gateway **et** dans le service ; limitation par IP au Gateway ; base isolée par NetworkPolicy.
- **Aucune dépendance** vers les autres services ni vers RabbitMQ : la lecture du fanzine reste disponible même si la boutique est dégradée.

## Décision 2 — hébergement en Europe

| Élément | Choix | Raison |
|---|---|---|
| Production | Kubernetes managé d'un fournisseur européen, région France, trois zones de disponibilité | Données personnelles (comptes, commandes, adresses, messages) dans l'UE (RGPD) ; fournisseur non soumis à une loi extraterritoriale imposant l'accès aux données |
| Bases PostgreSQL | Service managé du même fournisseur, même région, chiffrement au repos, sauvegardes chiffrées répliquées dans une **seconde région de l'UE** | PRA sans sortie de l'UE |
| Images de conteneurs | Registre du même fournisseur (copie des images signées construites par la CI) | Le déploiement ne dépend pas d'un registre hors UE |
| Identité | Keycloak hébergé dans le cluster | Comptes et mots de passe jamais confiés à un IdP tiers |
| Supervision | Prometheus, Grafana et Alertmanager dans le cluster | Journaux et métriques (identifiants de corrélation, noms affichés) restent dans l'UE |
| Site | Servi par le cluster ; un CDN éventuel est choisi avec des points de présence et une journalisation dans l'UE | Aucune ressource tierce chargée par le navigateur (déjà en place) |
| CI/CD (GitHub) | Code source et **données fictives** uniquement ; staging éphémère (kind) dans le runner, détruit à la fin du job | Aucune donnée personnelle réelle hors de l'hébergement de production |

Critères de choix du fournisseur (appel d'offres) : localisation des données et des sauvegardes, qualification ou certification de sécurité (ISO 27001, SecNumCloud si les clients institutionnels l'exigent), Kubernetes et PostgreSQL managés, réversibilité (manifestes Kubernetes standard, aucune API propriétaire dans le code), coût.

## Décision 3 — feuille de route

| Version | Fonction | Conception retenue |
|---|---|---|
| v2 | **Enchères** de pièces rares | `auction-service` : enchères datées, montant minimal d'incrément, prolongation automatique si une offre arrive dans les 2 dernières minutes (anti-« sniping ») ; enchère acceptée dans une transaction avec verrou de ligne (aucune offre perdue ni doublée) ; notifications de surenchère et de fin réutilisant celles de l'espace communautaire ; paiement du gagnant par le parcours de commande ; anti-fraude : compte vérifié, plafond d'enchères ouvertes. |
| v2 | **Diffusion des productions Evil Ed** | Vidéo à la demande : fichiers en stockage objet dans l'UE, diffusion HLS par segments signés à durée courte ; droit d'accès (achat ou location) vérifié comme pour les pages du fanzine ; sous-titres obligatoires (RGAA) ; service distinct pour isoler la charge réseau. |
| v3 | **Films du festival en ligne** | Séances à horaire fixe et jauge limitée : réservation d'une place comme une réservation de stock (décrément atomique, libération si non payée en 10 minutes) ; jeton de visionnage valable uniquement pendant la séance et sur un seul appareil à la fois ; test de charge de l'ouverture des réservations avant chaque festival. |

## Conséquences

- **Positives** : contenus et abonnements déployés, mis à l'échelle et sécurisés indépendamment de la vente ; contrôle d'accès à la page, sans fichier qui circule ; liseuse accessible ; le pipeline traite le nouveau service automatiquement (build, tests, couverture, image, scan, SBOM, staging, smoke tests) ; le modèle d'accès (droit vérifié à chaque lecture) sert de base à la vidéo de la v2.
- **Négatives** : un service et une base de plus à exploiter ; les numéros historiques doivent être saisis ou océrisés en texte (coût de numérisation) ; la mise en page d'origine du fanzine n'est pas reproduite à l'identique.

## Alternatives

- **PDF téléchargeables** : rejeté (fichier copiable et partageable sans contrôle, PDF numérisés rarement accessibles, pas de reprise de lecture).
- **CMS ou plateforme d'abonnement en SaaS** : rejeté (données des abonnés et adresses hors de la maîtrise de l'entreprise, hébergement UE non garanti, intégration Keycloak à refaire).
- **Intégrer les contenus au catalogue** : rejeté (domaines sans transaction commune ; un numéro numérique n'a pas de stock ; la charge de lecture serait imposée au catalogue).
