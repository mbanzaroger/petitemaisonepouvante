# Backlog du POC

## Épic 1 — Commander un produit dérivé en ligne (v1.0 à v1.2)

| ID | User story | Critères d'acceptation (Gherkin) |
|---|---|---|
| US1 | En tant que visiteur, je veux lister et consulter des produits afin de choisir. | **Étant donné** des produits en base, **quand** j'appelle `GET /api/v1/products`, **alors** j'obtiens une liste paginée avec prix et disponibilité. |
| US2 | En tant que client, je veux me connecter afin de passer commande. | **Étant donné** aucun jeton, **quand** j'appelle `POST /api/v1/orders`, **alors** je reçois 401. **Étant donné** un jeton `CUSTOMER` valide, **alors** l'accès est autorisé. |
| US3 | En tant que client authentifié, je veux commander des articles afin de les recevoir. | **Étant donné** un stock suffisant, **quand** je commande, **alors** la commande passe de `PENDING` à `CONFIRMED` et le stock diminue. **Étant donné** un stock insuffisant, **alors** elle passe à `CANCELLED` et le stock est inchangé. |
| US4 | En tant que client, je veux voir l'historique de mes commandes. | **Étant donné** deux clients, **quand** le client A liste ses commandes, **alors** il ne voit que les siennes ; l'accès à celle de B renvoie 403/404. |
| US5 | En tant qu'équipe, nous voulons métriques et logs afin de diagnostiquer. | Les métriques RED sont visibles dans Grafana ; un `correlationId` relie les logs d'une commande entre services. |
| US6 | En tant que visiteur puis client, je veux parcourir le catalogue, remplir un panier et commander depuis le site. | **Étant donné** le site ouvert, **quand** j'ajoute un produit et valide mon panier connecté avec un compte client, **alors** la commande est créée et son suivi passe à « Confirmée » sans recharger la page. **Étant donné** un compte non client, **alors** le panier explique pourquoi la commande est impossible. (v1.1) |
| US7 | En tant qu'administrateur, je veux consulter le stock en direct afin d'anticiper les ruptures. | **Étant donné** un compte `ADMIN`, **quand** j'ouvre « Stock », **alors** je vois disponible, réservé et un état (correct, bas, épuisé) ; un client est refusé. (v1.2) |

## Épic 2 — Espace communautaire de troc, de dons et de discussion (v1.3, ADR-004)

| ID | User story | Critères d'acceptation (Gherkin) |
|---|---|---|
| US8 | En tant que membre, je veux proposer un objet à l'échange ou au don, et en tant que visiteur consulter les annonces. | **Étant donné** des annonces en cours, **quand** un visiteur ouvre « Troc et dons », **alors** il les voit (filtres type, catégorie, texte). **Quand** un membre publie une annonce, **alors** elle est visible de tous ; **quand** il la retire, **alors** elle disparaît et les propositions en attente sont refusées. Un compte sans profil client reçoit 403. |
| US9 | En tant que membre, je veux faire une proposition sur une annonce et convenir de l'échange avec son auteur. | **Étant donné** une annonce d'alice, **quand** carol fait une proposition, **alors** alice est notifiée ; **quand** alice l'accepte, **alors** l'annonce est conclue, les autres propositions sont refusées et carol est notifiée. La conversation privée n'est visible que des deux participants (404 pour tout autre membre). Une seule proposition en attente par membre et par annonce (409) ; pas de proposition sur sa propre annonce (422). |
| US10 | En tant que membre, je veux discuter avec d'autres passionnés dans des salons thématiques. | **Étant donné** un salon, **quand** je publie un message, **alors** les autres membres le voient en quelques secondes sans recharger la page. Au-delà de 5 messages en 10 secondes, l'envoi est refusé (429) avec un message explicite. Les visiteurs non connectés n'ont pas accès aux salons. |
| US11 | En tant que membre, je veux un espace personnel pour régler mes notifications et lister les objets que je recherche. | **Étant donné** un objet recherché « Evil Ed », **quand** un autre membre publie une annonce qui le mentionne, **alors** je reçois une notification (sauf si je l'ai désactivée). Je règle séparément les notifications de propositions, de messages et de recherches ; 10 objets recherchés au plus ; notifications lues purgées après 90 jours. |
| US12 | En tant qu'administrateur, je veux modérer l'espace communautaire à partir des signalements des membres. | **Étant donné** un message ou une annonce signalé, **quand** l'administrateur le masque, **alors** il n'est plus visible, son auteur est notifié et tous les signalements du contenu sont clos ; il peut aussi rejeter un signalement. On ne signale ni son propre contenu (422) ni un contenu que l'on ne voit pas (404). |

## Épic 3 — Personnalisation : recommandations et centres d'intérêt (v1.4)

| ID | User story | Critères d'acceptation (Gherkin) |
|---|---|---|
| US13 | En tant que client, je veux des recommandations de produits selon mes recherches, mes consultations et mes achats, et découvrir la gamme exclusive Evil Ed. | **Étant donné** un visiteur, **quand** il ouvre le catalogue, **alors** il voit 4 produits, exclusivités Evil Ed en tête, avec la raison affichée. **Étant donné** un membre qui a activé la personnalisation dans « Mon espace », **quand** il recherche ou consulte des produits d'une catégorie, **alors** ses recommandations privilégient cette catégorie, sans les produits déjà achetés. Sans consentement, aucun signal n'est conservé ; retirer son consentement efface l'historique (90 jours au plus). Le catalogue se filtre sur la gamme exclusive. |
| US14 | En tant que membre, je veux être prévenu des nouvelles annonces dans les catégories que je consulte souvent. | **Étant donné** un membre qui a accepté les notifications selon sa navigation, **quand** il a consulté ou recherché au moins 3 fois une catégorie et qu'une annonce de cette catégorie est publiée, **alors** il reçoit une notification (une seule si l'annonce correspond aussi à un objet recherché). Sans accord, rien n'est enregistré ; décocher l'option efface ses centres d'intérêt (180 jours au plus). |

Les critères d'US8 à US12 sont vérifiés à trois niveaux : tests d'intégration du service (Testcontainers, 25 cas), scénarios Cucumber à travers le Gateway (`acceptance-tests/src/test/resources/features/us8-us12-communaute.feature`) et parcours Playwright + axe dans le navigateur (`frontend/e2e/communaute.spec.ts`).
