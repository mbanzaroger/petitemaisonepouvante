# 14 — Test de charge (indicateur 3)

> **Issue** : #36 · **Indicateur 3** (`docs/04-indicateurs-qualite.md`) : latence p95 < 300 ms et moins de 1 % d'erreurs sous charge.
> **Run de référence** : [CD staging 43740382781](https://github.com/mbanzaroger/petitemaisonepouvante/actions/runs/43740382781) du 15/11/2026, commit `c1c9461`, rapport HTML en artefact `charge-c1c9461…`.
> **Scénario et exécution** : `load-tests/README.md`.

## 1. Environnement de mesure

| Élément | Valeur |
|---|---|
| Machine | Runner GitHub `ubuntu-latest` : 4 vCPU, 16 Go, qui héberge **à la fois** le cluster et le générateur de charge |
| Cluster | kind, un nœud ; Envoy Gateway (TLS), Keycloak, RabbitMQ 1 nœud, 3 PostgreSQL, supervision kube-prometheus-stack |
| Services | 1 à 3 instances par service (HPA sur 70 % du CPU demandé) ; 250 m CPU demandés, 1 cœur maximum, 768 Mio |
| Générateur | JMeter 5.6.3 en mode ligne de commande, accès direct au NodePort du Gateway (pas de `kubectl port-forward`) |
| Parcours | 3 lectures du catalogue public ; création de commande, suivi et historique avec un jeton Keycloak réel |

Le générateur et le système testé partagent les mêmes 4 vCPU : les valeurs sont un ordre de grandeur pessimiste, pas une capacité de production.

## 2. Résultats

### Palier nominal (bloquant)

40 visiteurs (réflexion 0,3 à 1 s) et 10 clients authentifiés, 180 s après 30 s de montée en charge.

| Mesure | Seuil | Résultat |
|---|---|---|
| Latence p95 côté client (JMeter) | < 300 ms | **7 ms** ✅ |
| Taux d'erreur | < 1 % | **0 %** ✅ (11 283 requêtes API) |
| Débit | — | 63 req/s |
| Latence p95 côté serveur (Prometheus, hors `/actuator`) | — | 5 ms |
| Durée de saga p95 (création → CONFIRMED / CANCELLED) | — | 821 ms |
| Instances | — | 1 par service ; CPU maximal 19 % d'un cœur |

| Requête | Nombre | Moyenne | p95 |
|---|---|---|---|
| Catalogue — liste paginée | 3 389 | 2 ms | 5 ms |
| Catalogue — fiche produit | 3 372 | 1 ms | 4 ms |
| Catalogue — catégories | 3 361 | 1 ms | 4 ms |
| Commande — création (202) | 390 | 10 ms | 20 ms |
| Commande — suivi | 389 | 4 ms | 8 ms |
| Commande — historique | 382 | 5 ms | 10 ms |

### Palier de stress (observé)

150 visiteurs **sans temps de réflexion** (0 à 50 ms) et 10 clients authentifiés, 240 s après 60 s de montée.

| Mesure | Résultat |
|---|---|
| Débit | **1 904 req/s** (456 895 requêtes API) |
| Latence p95 côté client | 93 ms (commande : 171 ms) |
| Taux d'erreur | 0 % |
| Latence p95 côté serveur | 67 ms |
| Durée de saga p95 | 980 ms |
| Mise à l'échelle | `catalog-service` : 1 → **3 instances** (CPU 153 % de la demande), environ 75 s après le début du palier ; `order-service` et `stock-service` restent à 1 (CPU ≤ 42 %) |

## 3. Lecture des résultats

- **Indicateur 3 tenu avec une large marge** : 7 ms de p95 pour un seuil de 300 ms au palier nominal ; même à 30 fois ce débit, le p95 reste sous 100 ms et aucune requête n'échoue.
- **La mise à l'échelle horizontale fonctionne et se voit** : le catalogue, seul service saturé (94 % d'un cœur par instance), passe à 3 instances ; les nouvelles instances reçoivent du trafic sans erreur. Dans Grafana, le panneau « Débit » et le nombre de cibles `up` du service montrent la montée.
- **Le parcours de commande n'est pas le goulot** : son débit est volontairement borné par les temps de réflexion des clients, sous la limitation de débit du Gateway (50 requêtes/s par adresse IP sur `/api/v1/orders`).
- **La durée de saga (≈ 0,8 à 1 s au p95) vient de la conception, pas de la charge** : chaque boîte d'envoi est relevée toutes les 500 ms, deux fois par commande (OrderPlaced, puis StockReserved). Le client reçoit son 202 en 20 ms et la commande passe à CONFIRMED moins d'une seconde après. Réduire l'intervalle ou réveiller le publieur après validation (PostgreSQL `LISTEN/NOTIFY`) est noté au plan de remédiation.
- **Point de vigilance sécurité** : le catalogue public n'a pas de limitation de débit. Un seul client a pu envoyer 1 900 req/s et faire monter le service à son maximum d'instances : sans plafond, un afflux malveillant consomme les ressources (et le budget cloud). Traité dans `docs/13-analyse-securite.md` et le plan de remédiation.

## 4. Limites

- Générateur et système sur la même machine : le stress mesure aussi la contention CPU du runner.
- Un seul nœud et un seul broker : la résilience multi-nœuds (perte d'un nœud RabbitMQ) a été validée à part par l'expérimentation E3.
- Pas de test d'endurance (plusieurs heures) : fuites mémoire et dérive des files non couvertes.
- Données de démonstration (12 produits) : les index et la pagination ne sont pas éprouvés sur un catalogue réel.
