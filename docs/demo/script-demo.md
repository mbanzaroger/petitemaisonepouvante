# Script de démonstration (soutenance, 20 minutes dont environ 7 de démonstration)

Deux environnements possibles. **Préparer les deux** : la vidéo de secours (#41) est enregistrée sur l'environnement A.

| | A — Local (docker compose) | B — Staging (Kubernetes kind sur le poste) |
|---|---|---|
| Démarrage | `infra/init-env.sh` puis `cd infra && docker compose --profile app up -d --build` (≈ 3 min) | `kind create cluster --name pme` puis la procédure ci-dessous (≈ 8 min) |
| Ce que l'on montre | Parcours métier dans le site, Grafana, test de charge | Gateway TLS + JWT, NetworkPolicies, saga sur Kubernetes |
| Site | http://localhost:5173 | https://app.pme.local:8443 (certificat de l'AC du cluster à accepter) |
| Requêtes | Collection Bruno, environnement `local` | Collection Bruno, environnement `staging` |

## Préparation (la veille)
1. Vérifier que le dernier run **CD staging** de `develop` est vert (Actions) : il prouve le déploiement, les tests de bout en bout et Cucumber.
2. Démarrer l'environnement A, ouvrir Bruno (`docs/api/bruno/`), renseigner les 4 mots de passe secrets depuis `infra/.env`.
3. Ouvrir dans le navigateur : le dépôt (README), le dernier run CI, le kanban, Grafana (`http://localhost:3000`), le site (`http://localhost:5173`) dans une fenêtre privée, une seconde fenêtre privée connectée avec `admin-pme` sur « Stock », et les rapports Playwright et Lighthouse du dernier CD (artefacts `e2e-staging-…` et `lighthouse-staging-…`).
4. Lancer une fois le test de charge (`load-tests/`) pour réchauffer les services.

## Déroulé de la démonstration
| Durée | Étape | Ce qui est montré | Preuve attendue |
|---|---|---|---|
| 1 min | Pipeline | Dernier run CI : tests unitaires + Testcontainers, couverture, Trivy, SBOM ; CodeQL | Tous les jobs verts, résumé « Indicateur 1 » |
| 1 min | Catalogue (US1) | Site : filtre « Goodies », fiche du mug, ajout au panier (annonce) ; au clavier : Tab → « Aller au contenu » | Liste paginée, zone de statut, focus visible |
| 1 min | Sécurité (US2) | Site : « Se connecter pour commander » → page Keycloak (PKCE) → retour au panier conservé ; outils de développement : CSP dans les en-têtes, `localStorage` sans jeton ; Bruno 04 à 06 (401, 403) | Connexion sans mot de passe côté site ; jetons en mémoire ; refus sans jeton ou sans rôle |
| 2 min | Saga (US3) | Site : « Valider la commande » → suivi « En attente » puis « Confirmée » ; fenêtre `admin-pme` : « Actualiser » sur « Stock » → le mug passe de disponible à réservé ; puis 10 bustes de l'Orc (stock 2) → « Annulée » | Statut annoncé sans recharger ; effet de la saga visible côté exploitation ; annulation expliquée |
| 1 min | Historique (US4) | Site : « Mes commandes » ; Bruno 13 (commande d'autrui → 404) | Seules ses commandes ; 404 sur celle d'autrui |
| 2 min | Charge et observabilité | Test de charge JMeter (`load-tests/README.md`, commande « sur le poste ») avec Grafana « PME — RED et saga des microservices » à l'écran ; puis `grep` d'un correlationId dans les logs des 2 services | Débit, p95 < 300 ms, 0 % d'erreurs, commandes par étape ; mêmes identifiants dans order-service et stock-service |
| (option) | Kubernetes | `kubectl get pods,hpa,networkpolicy,gateway,httproute -n pme` ; dernier run CD lancé avec la case « charge » | Déploiements durcis, flux réseau explicites, montée du catalogue à 3 instances |

## Environnement B : staging sur le poste
```bash
kind create cluster --name pme
for s in catalog-service order-service stock-service web-frontend; do
  dir="services/$s"; [ "$s" = web-frontend ] && dir=frontend
  docker build -t "$s:demo" "$dir" && kind load docker-image "$s:demo" --name pme
  (cd k8s/overlays/staging && kustomize edit set image "ghcr.io/mbanzaroger/petitemaisonepouvante/$s=$s:demo")
done
bash k8s/staging-bootstrap.sh                 # variables écrites dans /tmp/pme-staging/staging.env
kubectl apply -k k8s/overlays/staging
kubectl wait --for=condition=available deployment --all -n pme --timeout=600s
echo "127.0.0.1 api.pme.local keycloak.pme.local app.pme.local" | sudo tee -a /etc/hosts
set -a; source /tmp/pme-staging/staging.env; set +a
scripts/smoke-test.sh "$BASE_URL"              # 13 contrôles de bout en bout
bash k8s/monitoring/install.sh && set -a && source /tmp/pme-monitoring.env && set +a
bash k8s/monitoring/verify.sh                  # 14 contrôles de supervision (US5)
(cd frontend && npm ci && npx playwright install chromium && npx playwright test)   # parcours du site + axe
```
Ne pas valider les modifications d'images faites par `kustomize edit` (`git checkout k8s/overlays/staging`).

## Plan B si une démonstration échoue
1. Montrer le dernier run **CD staging** (résumé : smoke tests, supervision US5, test de charge, DAST ; rapports Cucumber, Playwright avec captures du parcours, JMeter et ZAP en artefacts).
2. Lancer la vidéo de secours.
3. Expliquer la cause probable (dépendance externe, réseau) : c'est aussi un argument d'observabilité.
