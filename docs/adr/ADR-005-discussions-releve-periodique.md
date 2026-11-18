# ADR-005 — Discussions relevées périodiquement plutôt que par connexion persistante

- **Statut** : accepté (18/11/2026)
- **Contexte** : les salons et la conversation privée de chaque proposition doivent afficher les nouveaux messages sans recharger la page. Les options sont l'interrogation périodique (polling court), les Server-Sent Events et WebSocket. La plateforme passe par Envoy Gateway (TLS, JWT par requête, limitation de débit), une CSP stricte (`connect-src 'self'`) et des services sans état mis à l'échelle par HPA.
- **Décision** : le site relève les nouveaux messages par une requête courte toutes les 4 s (salon) ou 5 s (proposition), avec un **curseur** (`after` = identifiant du dernier message reçu) ; le premier appel renvoie les 50 derniers messages. Le relevé est suspendu quand l'onglet est masqué. Le compteur de notifications non lues est relevé toutes les 30 s et à chaque changement de page.
- **Conséquences positives** : chaque requête porte et vérifie le jeton (révocation et expiration naturellement prises en compte) ; aucune session collante ni diffusion entre instances : n'importe quelle instance répond ; compatible sans réglage avec le Gateway, la limitation de débit, la CSP et le relais nginx local ; curseur indexé (`message (room_code, id)`) : une requête « rien de nouveau » coûte une lecture d'index.
- **Conséquences négatives** : latence d'affichage de quelques secondes ; requêtes à vide. Ordre de grandeur pour 500 membres connectés dans un salon : 125 requêtes/s très légères, absorbées par une instance (test de charge à prévoir avant ouverture publique).
- **Évolution prévue** : passer aux Server-Sent Events (un flux par salon, diffusion entre instances par un échange RabbitMQ « fanout ») si la charge ou l'exigence de temps réel augmente, par exemple pour la diffusion des films du festival (v3).
- **Alternatives** :
  - WebSocket : rejeté pour le POC (authentification à la connexion seulement, sessions collantes ou bus de diffusion, configuration spécifique du Gateway).
  - Server-Sent Events : retenu comme évolution (plus simple que WebSocket, unidirectionnel suffisant) mais demande la diffusion entre instances.
