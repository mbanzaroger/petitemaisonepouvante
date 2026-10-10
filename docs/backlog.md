# Backlog du POC

**Épic** : Commander un produit dérivé en ligne.

| ID | User story | Critères d'acceptation (Gherkin) |
|---|---|---|
| US1 | En tant que visiteur, je veux lister et consulter des produits afin de choisir. | **Étant donné** des produits en base, **quand** j'appelle `GET /api/v1/products`, **alors** j'obtiens une liste paginée avec prix et disponibilité. |
| US2 | En tant que client, je veux me connecter afin de passer commande. | **Étant donné** aucun jeton, **quand** j'appelle `POST /api/v1/orders`, **alors** je reçois 401. **Étant donné** un jeton `CUSTOMER` valide, **alors** l'accès est autorisé. |
| US3 | En tant que client authentifié, je veux commander des articles afin de les recevoir. | **Étant donné** un stock suffisant, **quand** je commande, **alors** la commande passe de `PENDING` à `CONFIRMED` et le stock diminue. **Étant donné** un stock insuffisant, **alors** elle passe à `CANCELLED` et le stock est inchangé. |
| US4 | En tant que client, je veux voir l'historique de mes commandes. | **Étant donné** deux clients, **quand** le client A liste ses commandes, **alors** il ne voit que les siennes ; l'accès à celle de B renvoie 403/404. |
| US5 | En tant qu'équipe, nous voulons métriques et logs afin de diagnostiquer. | Les métriques RED sont visibles dans Grafana ; un `correlationId` relie les logs d'une commande entre services. |
