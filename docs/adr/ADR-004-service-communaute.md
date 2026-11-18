# ADR-004 — Un service dédié à l'espace communautaire

- **Statut** : accepté (18/11/2026)
- **Contexte** : le contexte demande un espace communautaire de troc et de dons entre particuliers (objets proposés, objets recherchés, notifications automatiques, modération) et un chat entre passionnés. Ces fonctions manipulent des données propres (annonces, propositions, messages, signalements), n'ont aucun lien transactionnel avec la vente (pas de prix, pas de stock, pas de paiement) et génèrent une charge différente : relevés fréquents des discussions, pics lors des soirées du festival.
- **Décision** : créer un quatrième microservice, `community-service` (Spring Boot 4.1, PostgreSQL `community`, Flyway), exposé sous `/api/v1/community/*`.
  - Membres identifiés par le `subject` du jeton Keycloak, jamais exposé aux autres membres (seul le nom affiché est montré).
  - Accès : lecture publique des annonces ; tout le reste réservé aux rôles `CUSTOMER` et `ADMIN` ; modération réservée à `ADMIN`. Contrôlé au Gateway (`SecurityPolicy` par route) **et** par le service.
  - Notifications internes (pas de courriel dans le POC), écrites dans la transaction de l'action qui les déclenche, filtrées par les préférences du membre.
  - Aucune dépendance vers les autres services ni vers RabbitMQ : le service reste disponible même si la boutique est dégradée.
- **Conséquences positives** : déploiement, mise à l'échelle et sécurité indépendants de la vente ; base isolée (NetworkPolicy dédiée) ; une panne de l'espace communautaire n'affecte pas les commandes ; le pipeline détecte et traite le service automatiquement (build, tests, couverture, image, scan, SBOM).
- **Conséquences négatives** : un service et une base de plus à exploiter ; les annonces ne référencent pas encore les produits du catalogue (évolution possible : lien vers une fiche produit, recommandations croisées).
- **Alternatives** :
  - Intégrer la communauté au catalogue : rejeté (couplage de deux domaines sans transaction commune, charge des discussions imposée au catalogue).
  - Solution de forum ou de chat tierce (SaaS) : rejetée (données personnelles hors de la maîtrise de l'entreprise, hébergement UE non garanti, intégration Keycloak et modération à refaire).
