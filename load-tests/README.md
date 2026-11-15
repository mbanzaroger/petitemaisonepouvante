# Test de charge JMeter (indicateur 3)

Objectif : vérifier que la boutique tient une charge réaliste avec **une latence p95 < 300 ms et moins de 1 % d'erreurs**, et observer la mise à l'échelle horizontale (HPA) dans Grafana. Issue #36.

## Scénario `pme-charge.jmx` (JMeter 5.6.3)

| Groupe | Utilisateurs virtuels | Parcours | Temps de réflexion |
|---|---|---|---|
| Visiteurs — catalogue public | 40 (`catalog_threads`) | liste paginée, fiche d'un produit au hasard, catégories | 0,3 à 1 s |
| Clients — commande authentifiée | 10 (`order_threads`) | connexion Keycloak une fois (alice / carol), création de commande (202), suivi, historique | 0,8 à 2 s |

- Montée en charge sur 30 s (`rampup`), puis palier de 180 s (`duration`).
- Chaque requête porte un `X-Correlation-Id` `charge-<utilisateur>-<itération>` : une requête lente se retrouve dans les logs.
- Les commandes visent les produits les mieux approvisionnés ; quand le stock s'épuise, la saga annule la commande (comportement normal, la requête reste un succès 202).
- Le débit des clients reste sous la limitation de débit du Gateway (50 requêtes/s par adresse IP sur `/api/v1/orders`) : le test mesure la performance, pas la protection, démontrée par les smoke tests.
- Seuils calculés sur les requêtes API (`API …`) : la connexion Keycloak, faite une fois par utilisateur, est exclue du rapport.

## Exécution

**En CI (référence)** : *Actions → CD staging → Run workflow*, branche voulue, case **« Lancer le test de charge JMeter »** cochée. Le workflow déploie le staging, installe la supervision puis lance `load-tests/run.sh` :

1. télécharge JMeter 5.6.3 depuis l'archive Apache et vérifie son empreinte SHA-512 ;
2. vise directement le NodePort du Gateway (un `kubectl port-forward` ajouterait sa propre latence) ;
3. passe les mots de passe de test par un fichier de propriétés temporaire (jamais sur la ligne de commande) ;
4. publie le tableau des indicateurs dans le résumé du run et le rapport HTML JMeter en artefact `charge-<commit>` ;
5. échoue si un seuil n'est pas tenu (indicateur bloquant quand le test est lancé).

Mesures croisées côté serveur dans le même résumé (Prometheus) : p95 des services, durée de saga p95, nombre maximal d'instances par service pendant le test.

**Sur le poste (démonstration)**, contre l'environnement docker compose (sans Gateway) :

```bash
cd infra && ./init-env.sh && docker compose --profile app up -d --build && cd ..
set -a; source infra/.env; set +a
printf 'alice_password=%s\ncarol_password=%s\n' "$PME_ALICE_PASSWORD" "$PME_CAROL_PASSWORD" > /tmp/pme-secrets.properties
jmeter -n -t load-tests/pme-charge.jmx -q /tmp/pme-secrets.properties \
  -Jprotocol=http -Japi_host=localhost -Jcatalog_port=8081 -Jorder_port=8082 \
  -Jkc_protocol=http -Jkc_host=localhost -Jkc_port=8080 -Jduration=120 \
  -Jjmeter.reportgenerator.sample_filter='^API .*' -l /tmp/resultats.jtl -e -o /tmp/rapport-charge
```

Pendant le test, le tableau de bord Grafana « PME — RED et saga des microservices » montre le débit, le p95 par rapport au seuil de 300 ms, les commandes par étape et la boîte d'envoi.

## Paramètres (`-J<nom>=<valeur>`)

| Propriété | Défaut | Rôle |
|---|---|---|
| `protocol`, `api_host`, `api_port` | `https`, `api.pme.local`, `8443` | Point d'entrée de l'API |
| `catalog_port`, `order_port` | `api_port` | Ports distincts quand il n'y a pas de Gateway (local) |
| `kc_protocol`, `kc_host`, `kc_port` | `https`, `keycloak.pme.local`, `api_port` | Keycloak |
| `catalog_threads`, `order_threads` | `40`, `10` | Utilisateurs virtuels |
| `rampup`, `duration` | `30`, `180` | Montée en charge et palier (s) |
| `alice_password`, `carol_password` | — | Mots de passe des comptes de test (fichier `-q`) |
