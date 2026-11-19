# 13 — Analyse de sécurité de la V1

> **Issue** : #38 · **Date** : 15/11/2026, complétée le 16/11/2026 pour le site web (#92, §7) · **Périmètre** : le site `web-frontend`, les 3 services, le Gateway (Envoy Gateway), Keycloak, RabbitMQ, PostgreSQL, le staging Kubernetes et la chaîne CI/CD.
> **Suite** : chaque constat ouvert a une action dans le plan de remédiation (`docs/11-plan-remediation.md`).
> **Référentiels** : OWASP Top 10 2021 (comme la politique de sécurité, `docs/07` §10), sévérités et délais de la politique de sécurité (§6).

## 1. Méthode : sources consolidées

| Source | Outil | Périmètre | Quand | Résultat au 15/11/2026 |
|---|---|---|---|---|
| Analyse statique (SAST) | CodeQL `java-kotlin` et `actions`, requêtes *security-extended* | Code des services, workflows | Chaque PR, push, hebdomadaire | 3 alertes levées depuis le début du projet, toutes corrigées (V-05, V-06) |
| Dépendances (SCA) | Trivy fs (bloquant critique/haute corrigeable), Dependency Review, Dependabot | `pom.xml`, actions, images, compose | Chaque PR, hebdomadaire | 0 vulnérabilité dans les bibliothèques Java |
| Images | Trivy image : bloquant en CI (critique/haute corrigeable), **rapport hebdomadaire toutes sévérités** (`security-report.yml`) | 3 images publiées sur GHCR | Chaque build, hebdomadaire | Système de base : 8 hautes, 47 moyennes, 23 basses, 6 indéterminées, **toutes sans correctif publié** (V-01) |
| Infrastructure as Code | Trivy config sur le **rendu Kustomize** du staging | Manifestes réellement appliqués | Chaque PR, hebdomadaire | 4 règles basses ou moyennes (V-15, V-21), 1 exception datée (V-16) |
| Secrets | gitleaks (historique complet sur lancement manuel) | Dépôt et historique | Chaque PR et push | 0 secret ; 2 faux positifs qualifiés dans `.gitleaksignore` (V-22) |
| DAST | OWASP ZAP baseline (passif) + scan actif de l'API depuis le contrat OpenAPI, authentifié ; baseline du site depuis le 16/11/2026 | Staging déployé | Chaque déploiement | API, après corrections : 0 échec, 0 avertissement, 120 règles passées (V-03, V-04) ; site : 0 échec, 63 règles passées, 1 avertissement qualifié (V-25) et 4 alertes informatives qualifiées |
| Charge et volume | JMeter : palier nominal et palier de stress | Staging déployé | À la demande | p95 7 ms au nominal ; 1 904 req/s acceptées sans plafond sur le catalogue (V-11) |
| Qualité | SonarQube Cloud | Code des services | Chaque PR | Inactif, en attente du jeton (V-20) |
| Revue manuelle | Modèle STRIDE (`docs/05`), configuration, pipeline | Ensemble du système | Jalon J4 | Constats V-02, V-10, V-12 à V-14, V-17 à V-19, V-23, V-24 |
| Site web (16/11/2026) | ESLint `jsx-a11y`, Vitest, Playwright (en-têtes, stockage, rôles), axe-core, ZAP baseline du site, Trivy (lockfile npm et image nginx) | SPA et image `web-frontend` | Chaque PR et chaque déploiement | Constats V-25 à V-27 (§7) |

**Rapport consolidé** : le workflow « Rapport de sécurité » (`.github/workflows/security-report.yml`) relance chaque lundi les scans des images (toutes sévérités, avec ou sans correctif) et de la configuration Kubernetes rendue. Il complète la CI, réglée pour ne bloquer que ce qui est corrigeable.

## 2. Synthèse

Décompte par sévérité **retenue** (après réévaluation dans le contexte, voir §3) :

| Statut | Critique | Haute | Moyenne | Basse | Total |
|---|---|---|---|---|---|
| Corrigé ou évité | 3 | 3 | 3 | 2 | 11 |
| Exception datée ou risque accepté | — | — | 1 | 4 | 5 |
| À traiter (plan de remédiation) | — | 1 | 8 | 2 | 11 |
| **Total** | **3** | **4** | **12** | **8** | **27** |

**Indicateur 4** (`docs/04`) : **0 vulnérabilité critique ou haute corrigeable non traitée** (la critique du site, V-27, a été bloquée par la CI puis corrigée avant fusion). Le seul constat de sévérité haute encore ouvert (V-17) ne concerne que la future production : il est bloquant pour la mise en production et planifié en priorité 1. Les 8 vulnérabilités hautes du système de base (V-01) n'ont pas de correctif publié ; elles relèvent d'une exception justifiée, conformément à la politique de sécurité (§6).

## 3. Registre des vulnérabilités

Sévérité *outil* : celle du scanner ou de la règle. Sévérité *retenue* : réévaluée dans le contexte (exposition, conditions d'exploitation, mesures existantes) ; c'est elle qui fixe le délai de traitement.

| ID | Constat | Source | OWASP | Sévérité outil → retenue | Exploitabilité | Statut |
|---|---|---|---|---|---|---|
| V-01 | Bibliothèques du système de base distroless Debian 13 : expat (4 hautes), util-linux `libuuid` (4 hautes), glibc et libstdc++ (moyennes), **aucune corrigée par Debian** | Trivy image (rapport hebdomadaire) | A06 | Haute → **Basse** | Faible : la JVM n'utilise ni expat ni util-linux (seule `libuuid` est présente, sans les commandes `mount`/`nsenter` visées) ; conteneur non root, en lecture seule, sans shell. Seul le résolveur DNS de la glibc est sollicité (CVE-2026-6238, réponse DNS forgée) : il faudrait contrôler le DNS du cluster | Exception datée, réexamen hebdomadaire |
| V-02 | Console d'administration Keycloak et royaume `master` exposés par la route du Gateway | Revue manuelle | A01, A05 | — → **Haute** | Moyenne : interface d'administration et point de jeton de l'administrateur joignables depuis l'extérieur | **Corrigé** : route limitée à `/realms/pme/` et `/resources/` |
| V-03 | En-tête HSTS absent (TLS terminé au Gateway, services en HTTP) | ZAP 10035 | A05 | Basse → Moyenne | Faible : déclassement HTTPS au premier accès | **Corrigé** (#71) |
| V-04 | `Cross-Origin-Resource-Policy` absent puis insuffisant (`same-site`) | ZAP 90004 | A05 | Basse | Faible | **Corrigé** : `same-origin` (#71) |
| V-05 | CD déclenché par `workflow_run` : code d'un autre workflow exécuté dans le contexte privilégié de la branche par défaut | CodeQL (2 alertes) | A08 | Haute | Moyenne : empoisonnement du cache des actions | **Corrigé** : workflow réutilisable (#63) |
| V-06 | Protection CSRF désactivée globalement | CodeQL `java/spring-disabled-csrf-protection` | A01 | Haute → Basse | Faible : API sans session ni cookie, jeton Bearer | **Corrigé** : exemption limitée à `/api/**` (#47) |
| V-07 | `amqp-client` 5.30.0 géré par Spring Boot (CVE-2026-63337, -69219, -69220, -75516) | Trivy image (bloquant) | A06 | Haute | Moyenne | **Corrigé** : 5.37.1 (#48) |
| V-08 | Image de base distroless Debian 12 : 1 critique (brotli), 9 hautes (expat), corrigées dans Debian mais plus reportées | Trivy image (bloquant) | A06 | Critique | Faible | **Corrigé** : distroless Debian 13 (#43) |
| V-09 | Compromission de l'action `trivy-action` (GHSA-69fq-xp46-6x23, mars 2026) | Veille | A08 | Critique | Élevée pour un dépôt qui référence les actions par tag | **Évité** : actions tierces épinglées par SHA dès v0.3.0 |
| V-10 | Le staging déployait l'image `:develop` au lieu de celle du commit testé | Revue (US5) | A08 | — → Moyenne | Sans objet : perte de traçabilité, tests menés sur un autre code | **Corrigé** : garde-fou d'image dans le CD (#64) |
| V-11 | Pas de limitation de débit sur le catalogue public ; celle des commandes est locale à chaque instance d'Envoy | Test de charge (1 904 req/s d'un seul client, mise à l'échelle forcée) | A04 (déni de service) | — → **Moyenne** | Élevée : aucune authentification nécessaire | À traiter (R-01) |
| V-12 | Flux internes en clair : Gateway → services, services → PostgreSQL et RabbitMQ | Revue manuelle | A02 | — → Moyenne | Faible : NetworkPolicies en refus par défaut, il faut déjà être dans le cluster | À traiter (R-05) |
| V-13 | Secrets Kubernetes non chiffrés au repos (etcd), pas de coffre-fort ni de rotation | Revue manuelle | A02 | — → Moyenne | Faible : accès à etcd ou aux sauvegardes nécessaire | À traiter (R-03) |
| V-14 | Images non signées ; aucune vérification de provenance à l'admission | Revue manuelle | A08 | — → Moyenne | Faible : accès en écriture au registre nécessaire | À traiter (R-06) |
| V-15 | Composants tiers référencés par tag : image ZAP `stable`, manifestes d'opérateurs, charts, images PostgreSQL, RabbitMQ, Keycloak | Revue + Trivy KSV-0125 | A08 | Moyenne → Basse | Faible | À traiter (R-06) |
| V-16 | Keycloak de staging en mode développement : base H2, système de fichiers en écriture, une seule instance | Trivy KSV-0014 | A05 | Haute → Moyenne | Faible en staging | Exception datée (`.trivyignore.yaml`), production : R-02 |
| V-17 | Client `pme-tests` à mot de passe direct (jetons de 15 min en staging) présent dans le royaume | Revue manuelle | A07 | — → **Haute** si présent en production | Nulle en staging ; élevée en production (contournement de l'authentification forte) | À traiter (R-02), **bloquant pour la production** |
| V-18 | Journal d'audit sans identifiant du client (exigence STRIDE « répudiation » non tenue) | Revue manuelle | A09 | — → Moyenne | Sans objet | **Corrigé** : le log de création porte le *subject* Keycloak (pseudonyme) |
| V-19 | Alertes reçues par Alertmanager mais routées vers personne | Revue manuelle | A09 | — → Moyenne | Sans objet : détection sans réaction | À traiter (R-07) |
| V-20 | Quality Gate SonarQube Cloud inactif (indicateur 2 non mesuré) | Revue manuelle | — | — → Moyenne | Sans objet (processus) | À traiter (R-08, action du Lead Dev) |
| V-21 | Bases de données et Keycloak : UID/GID ≤ 10000, CPU non limité | Trivy KSV-0020, KSV-0021, KSV-0011 | A05 | Basse | Faible | À traiter (R-10) |
| V-22 | Identifiants de développement par défaut dans l'historique Git (premier docker compose) | gitleaks (scan complet) | A07 | — → Basse | Nulle : jamais utilisés hors du poste, remplacés par des secrets générés (#61) | Risque accepté (historique conservé) |
| V-23 | Durée de conservation des commandes non définie | Revue (RGPD art. 5.1.e) | — | — → Moyenne | Sans objet (conformité) | À traiter (R-09) |
| V-24 | `metrics-server` avec `--kubelet-insecure-tls` | Revue manuelle | A02 | — → Basse | Nulle hors du cluster de test | Risque accepté (kind uniquement) |
| V-25 | Site sans `Cross-Origin-Embedder-Policy` : isolation contre les attaques de type Spectre incomplète | ZAP 90004 (site) | A05 | Basse | Très faible : aucune ressource tierce chargée, COOP et CORP `same-origin` posés ; COEP bloquerait l'iframe de vérification de session Keycloak | Risque accepté (WARN qualifié dans `.zap/rules-site.tsv`) |
| V-26 | Accessibilité contrôlée automatiquement seulement (axe, `jsx-a11y`) : pas d'audit RGAA manuel ni de déclaration d'accessibilité | Revue (RGAA 4.1) | — | — → **Moyenne** | Sans objet (conformité légale, exclusion d'utilisateurs) | À traiter (R-13, #94) |
| V-27 | Image `nginx-unprivileged:1.30-alpine` : 1 critique (brotli) et 12 hautes (curl, expat, libxslt, musl, zlib) corrigées par Alpine mais pas encore dans l'image amont | Trivy image (bloquant, CI de la PR #93) | A06 | **Critique** | Faible : nginx ne décompresse pas de brotli ni n'exécute curl ; conteneur non root en lecture seule | **Corrigé** : `apk upgrade` à la construction, scan vert |
| V-28 | Image du site : nginx 1.30.6, 10 CVE corrigées par nginx 1.30.7 du 18/11/2026 (HTTP/2, HTTP/3, TLS 1.3, resolver, mail, stream, protocole PROXY, alias), pas encore empaqueté pour Alpine 3.24 | Trivy image (bloquant, CI de la PR #112) | A06 | Haute → **Basse** | Très faible : nginx écoute en HTTP/1.1 sans TLS derrière le Gateway, sans module mail ni stream, sans resolver, protocole PROXY ni alias ; conteneur non root en lecture seule | Exception datée jusqu'au 26/11/2026 (`.trivyignore.yaml`, délai d'une haute) ; le Dockerfile installe 1.30.7 depuis nginx.org dès sa publication |
| V-29 | Traversée de répertoire signalée sur `POST /api/v1/community/listings` puis `/community/wishes` (201) par le scan actif de l'API | ZAP [6] (bloquant, CD du 19/11/2026) | A01 | Haute → **Faux positif** | Nulle : l'attaque est le dernier segment de l'URL, sans preuve dans la réponse (heuristique de ZAP qui compare une création acceptée à un refus de validation) ; les services communauté et éditions enregistrent du texte sans aucun accès au système de fichiers (revue du code : ni `java.io.File` ni `java.nio.file`) | Qualifié : règle hors périmètre pour ces deux services (`.zap/rules.tsv`), toujours bloquante sur le catalogue, les commandes et le stock ; preuves des alertes moyennes et hautes publiées dans le résumé du CD |

## 4. Résultats sans constat

- **Injections** : le scan actif de ZAP sur les 12 opérations du contrat OpenAPI (SQL, PostgreSQL temporisé, commande système, SSRF, XXE, SSTI, traversée, CRLF, XSS) ne remonte rien. Les requêtes sont paramétrées (`JdbcClient`) et les entrées validées (au plus 20 lignes par commande, quantité de 1 à 10, page de 1 à 100 éléments).
- **Contrôle d'accès** : 401 sans jeton et 403 sans rôle au Gateway **et** dans chaque service ; 404 sur la commande d'un autre client (tests d'intégration, Cucumber, smoke tests à chaque déploiement).
- **Falsification de prix** : un prix envoyé par le client est ignoré, le total est relu dans le catalogue (test d'intégration dédié).
- **Divulgation d'erreurs** : réponses `application/problem+json` sans pile d'appels (ZAP 90022 passé).
- **Messages empoisonnés** : un message illisible part en file de rebut au lieu de bloquer la file (tests d'intégration, expérimentation E3), et l'alerte `MessagesEnRebut` le signale.
- **Rejeu d'événements** : un événement rejoué ne décrémente le stock qu'une fois ; les doublons sont comptés (`pme_stock_reservations_total{outcome="duplicate"}`).

## 5. Comportement sous charge et sous attaque par volume

| Situation | Observation | Lecture sécurité |
|---|---|---|
| Rafale de 120 requêtes simultanées sur `/api/v1/orders` (smoke tests) | 28 à 35 réponses 429 selon les runs | La limitation de débit du Gateway protège le parcours authentifié |
| 150 visiteurs sans temps de réflexion sur le catalogue (palier de stress) | 1 904 req/s acceptées, 0 % d'erreurs, p95 93 ms, `catalog-service` porté à 3 instances (son maximum) | Disponibilité préservée grâce au HPA, mais **sans plafond** : un afflux malveillant consomme toute la capacité prévue et le budget cloud (V-11) |
| Commandes pendant le stress | p95 171 ms à la création, aucune erreur | Le catalogue saturé ne dégrade pas le parcours d'achat : les services sont isolés |
| Broker injoignable (expérimentation E3, alerte `BoiteEnvoiBloquee`) | Commandes acceptées et conservées dans la boîte d'envoi, publiées au retour | Pas de perte de commande ; détection par alerte en 2 minutes |

## 6. Points forts à conserver

Défense en profondeur sur l'authentification (Gateway et services), NetworkPolicies en refus par défaut, conteneurs non root en lecture seule sans capacités, actions épinglées par SHA, SBOM et provenance des images, secrets générés à l'exécution et jamais versionnés, alertes testées en CI, et une chaîne qui a **elle-même détecté** quatre des constats corrigés (V-05, V-06, V-07, V-08).

## 7. Site web (`web-frontend`, 16/11/2026)

Le site ajoute une surface exposée : du code exécuté dans le navigateur des clients, une dépendance à l'écosystème npm et une image nginx. Analyse STRIDE ciblée et mesures retenues (ADR-002 révisé) :

| Menace | Scénario | Mesures | Preuve |
|---|---|---|---|
| Injection de script (XSS) | Un nom de produit ou un détail d'erreur malveillant exécute du code dans la page | React échappe tout texte affiché (aucun `dangerouslySetInnerHTML`) ; CSP `script-src 'self'` sans `unsafe-inline` ni `unsafe-eval` ; seul le détail des refus métier (422) est affiché, les autres erreurs ont un message fixe | Build vérifié sans code en ligne (CI) ; en-têtes contrôlés par Playwright et ZAP (10038, 10055 bloquants) ; test unitaire « détail technique jamais affiché » |
| Vol de jeton | Un script injecté ou une extension lit le jeton d'accès | Jetons **en mémoire** (keycloak-js), jamais dans `localStorage`, `sessionStorage` ni cookie ; durée de vie de 5 min, renouvelés 30 s avant expiration ; `Referrer-Policy: no-referrer` | Test Playwright « aucun jeton n'est conservé dans le stockage du navigateur » |
| Interception du code d'autorisation | Le code renvoyé par Keycloak est réutilisé par un tiers | Flux code + **PKCE S256** exigé par le client `pme-web` ; redirections limitées au site (`https://app.pme.local[:8443]/*`) ; réponse dans le fragment d'URL, effacé aussitôt | Configuration du royaume ; test unitaire de l'initialisation |
| Requête intersite (CSRF) | Une page tierce déclenche une commande au nom du client | Aucun cookie ni authentification « ambiante » vers l'API : le jeton est ajouté explicitement par le site ; même origine, aucune règle CORS | Test Playwright : `fetch` avec `credentials: 'include'` sans jeton → 401 |
| Détournement de clics | Le site est intégré dans un cadre invisible | `frame-ancestors 'none'` et `X-Frame-Options: DENY` (la page de vérification de session n'accepte que le site lui-même) | ZAP 10020 bloquant |
| Élévation de privilèges | Un compte sans rôle accède aux commandes | Le site masque les actions, mais le Gateway **et** le service refusent (défense en profondeur) | Test Playwright avec `bob` ; tests Cucumber 403 |
| Chaîne d'approvisionnement npm | Paquet compromis ou script d'installation malveillant | Versions exactes et lockfile, `npm ci --ignore-scripts`, Dependabot hebdomadaire, Trivy sur le lockfile ; seules 4 bibliothèques livrées (React, React DOM, React Router, keycloak-js) | CI « SCA » et « Front-end » |
| Conteneur | Prise de contrôle de nginx | Image non root (UID 101), système de fichiers en lecture seule, capacités retirées, aucune sortie réseau (NetworkPolicy), correctifs Alpine appliqués à la construction (V-27) | CI : démarrage en lecture seule, Trivy bloquant |
| Divulgation | Fichiers cachés, version du serveur | `server_tokens off`, 404 sur les fichiers commençant par un point, configuration publique limitée à l'URL de Keycloak, au royaume et au client | ZAP baseline du site |

**Compléments du 17/11/2026 (#100)** :

| Évolution | Effet sur la surface d'attaque | Mesure |
|---|---|---|
| Espace administrateur (stock) servi sur `app.pme.local` | La route `/api/v1/stock` devient joignable depuis l'origine du site | Même `SecurityPolicy` qu'`api.pme.local` (JWT valide **et** rôle ADMIN au Gateway), contrôle répété dans stock-service ; test Playwright : un client est refusé |
| Identifiant de corrélation envoyé par le navigateur | Valeur choisie par le client, écrite dans les journaux | Format imposé `[A-Za-z0-9-]{1,64}` par les services (sinon remplacé), aucune donnée personnelle ; affiché au client seulement pour les erreurs techniques |
| Journaux d'accès nginx | Nouvelle source de données personnelles possible | Format JSON sans adresse IP ni agent utilisateur ; sondes non journalisées |
| Thème Keycloak « pme » | Ressources servies par Keycloak | CSS seulement, aucun script ni ressource externe ; contrôlé par axe dans le parcours |
| Exporteur nginx (sidecar) | Port 9113 ouvert dans le pod | `stub_status` limité à 127.0.0.1, NetworkPolicy : collecte depuis le namespace `monitoring` seulement, conteneur non root en lecture seule |

**Risques résiduels** : un script injecté malgré la CSP pourrait appeler l'API **pendant** la session (le jeton en mémoire reste utilisable par la page) ; la CSP et l'échappement systématique rendent ce scénario improbable. La page de connexion Keycloak garde le thème par défaut : son accessibilité sera auditée avec celle du site (R-13).

**Résultats** (CD du 16/11/2026 sur la branche du site, staging kind) :
- Playwright : **6 tests sur 6** verts — parcours confirmé et parcours annulé faute de stock, en-têtes et CSP, aucun jeton dans le stockage, compte sans rôle refusé, lien d'évitement ;
- axe-core : **0 violation** sur 8 pages ou états (catalogue, fiche produit, panier visiteur et vide, suivi de commande, historique, connexion requise, page introuvable) ;
- ZAP baseline du site : **0 échec**, 63 règles passées ; COEP absent (V-25, risque accepté) ; 4 alertes informatives qualifiées dans `.zap/rules-site.tsv` (cache voulu, application monopage, mots repérés dans le code minifié des bibliothèques) ;
- CD du 17/11/2026 (site v2, branche) : **10 tests Playwright sur 10**, axe sans violation sur **14 pages ou états** dont la page de connexion Keycloak ; Lighthouse (bureau) **100 / 100 / 100 / 100** sur le catalogue, une fiche produit et le plan du site ; ZAP du site toujours sans échec ; supervision : 5 cibles, journaux JSON du site et appels `web-…` retrouvés dans les logs d'order-service ;
- incident de chaîne : le port-forward vers le Gateway est tombé pendant le scan actif de l'API d'un premier run ; le site est désormais scanné avant le scan actif et l'accès est vérifié, puis relancé si besoin, avant chaque scan (`scripts/dast.sh`).


## 8. Espace communautaire (`community-service`, 18/11/2026)

Le troc, les dons et les discussions ouvrent une surface nouvelle : du **contenu écrit par les membres** affiché à d'autres membres, des **échanges privés** et des données personnelles plus riches. Analyse STRIDE ciblée (ADR-004, ADR-005) :

| Menace | Scénario | Mesures | Preuve |
|---|---|---|---|
| Usurpation | Publier ou écrire au nom d'un autre membre | L'auteur est toujours le `subject` du jeton vérifié, jamais un champ de la requête ; nom affiché tiré du jeton | Tests d'intégration (auteur et `mine`) |
| Accès à la conversation d'autrui (IDOR) | Lire ou écrire dans la proposition de deux autres membres en devinant l'identifiant | Identifiants UUID aléatoires ; accès réservé aux deux participants, **404** pour tout autre membre (pas d'énumération), y compris pour un administrateur ; un message privé n'est signalable que par ses participants | `OfferApiIT`, `ModerationApiIT`, contrôle de fumée « proposition vue par un tiers : 404 » |
| Altération | Accepter sa propre proposition, retirer l'annonce d'un autre, courses entre acceptations | Règles portées par le service (403/404/409/422) ; verrous de ligne pris dans un ordre fixe (annonce puis proposition) ; une seule proposition en attente garantie par un index unique partiel | `OfferApiIT` (refus, conflits), `ListingApiIT` (retrait) |
| Injection de script (XSS) stockée | Un message ou une annonce contient du HTML ou du JavaScript | Texte stocké brut et affiché comme texte par React (jamais interprété) ; CSP `script-src 'self'` ; longueurs bornées (titre 120, description 2 000, message 1 000) | Tests de validation (400), ZAP du site |
| Injection SQL | Recherche d'annonces avec `%`, `_` ou SQL | Requêtes paramétrées uniquement, caractères spéciaux de `LIKE` neutralisés | `ListingRepositoryTest`, `ListingApiIT` |
| Déni de service, spam | Rafales de messages, d'annonces ou de signalements | Anti-flood applicatif par membre (5 messages / 10 s → 429), 10 objets recherchés au plus, limitation par IP au Gateway (20 req/s sur la route communauté), signalement idempotent (un par membre et par contenu) | `RoomApiIT` (429), `NotificationApiIT` (limite), routes Gateway |
| Contenu illicite, harcèlement | Annonces de vente déguisée, insultes, données personnelles publiées | Signalement par tout membre, file de modération réservée à `ADMIN` (Gateway + service), contenu masqué et auteur prévenu ; alerte `ModerationEnAttente` si plus de 5 signalements attendent 30 min | `ModerationApiIT`, test d'alerte promtool, parcours Playwright |
| Divulgation de données personnelles | Identifiant Keycloak ou courriel d'un membre exposé | Seul le nom affiché est renvoyé ; l'identifiant de l'auteur d'un contenu signalé n'est pas transmis à la modération ; charte affichée (pas de coordonnées dans les textes) | `ModerationApiIT` (`targetAuthorId` absent) |
| Élévation de privilèges | Un compte sans rôle publie ou modère | `SecurityPolicy` par route (membres : `CUSTOMER` ou `ADMIN` ; modération : `ADMIN`), mêmes règles dans le service | Contrôles de fumée 401/403, Cucumber `bob` |

**RGPD** : base légale « exécution du service » pour les annonces et messages ; minimisation (aucun courriel ni adresse stockés, nom affiché seulement) ; conservation : notifications lues supprimées après 90 jours, messages des salons après 365 jours (tâche nocturne testée), conversations liées au cycle de vie de l'annonce ; données hébergées dans l'UE avec le reste de la plateforme. **Reste à faire avant ouverture publique** : effacement des contenus d'un membre à la suppression de son compte (événement Keycloak à consommer), modération a priori des mots interdits, test de charge des relevés de discussion (ADR-005).

## 9. Personnalisation (recommandations et centres d'intérêt, US13 et US14)

| Risque | Mesures | Preuve |
|---|---|---|
| Profilage sans base légale (RGPD art. 6 et 22, ePrivacy) | Personnalisation et notifications de navigation **désactivées par défaut** ; consentement explicite dans « Mon espace » ; sans consentement, les signaux envoyés sont ignorés et rien n'est conservé ; le site n'envoie de signal que si le consentement est actif | `RecommendationApiIT` (« sans consentement »), `NotificationApiIT` (US14) |
| Conservation excessive | Signaux d'intérêt purgés après 90 jours, centres d'intérêt de navigation après 180 jours sans consultation (tâches nocturnes testées) ; retrait du consentement = effacement immédiat ; bouton « Effacer mon historique » | Tests de conservation et d'effacement |
| Opacité de la recommandation | Raison affichée pour chaque produit recommandé (catégorie d'intérêt, exclusivité, sélection) ; aucune décision automatisée produisant un effet juridique | Tests du site |
| Abus (volume) | 500 signaux par membre et par 24 h au plus ; limitation par IP au Gateway sur `/api/v1/interests` ; route réservée aux membres (JWT) | `RecommendationService`, routes Gateway |
| Fuite entre membres | Les signaux sont rattachés au `subject` du jeton ; aucune API ne renvoie les centres d'intérêt d'un autre membre ; aucune donnée transmise à des tiers | Revue de code, OpenAPI |

## 10. Éditions : actualités, fanzine numérique et abonnements (`editorial-service`, US15 à US17)

Le service ouvre deux surfaces nouvelles : des **contenus payants** à protéger et une **donnée personnelle sensible pour l'entreprise**, l'adresse de livraison du fanzine papier. Analyse ciblée (ADR-006) :

| Menace | Scénario | Mesures | Preuve |
|---|---|---|---|
| Lecture sans droit | Demander directement la page 3 d'un numéro sans l'avoir acheté, ou rejouer l'URL d'un abonné | Droit vérifié **à chaque page** par le service (achat ou abonnement en cours, à la date du jour) : 401 sans jeton, 403 sans droit ; aucun fichier ni URL de document à partager ; l'extrait (page 1) est le seul contenu public | `FanzineApiIT`, contrôles de fumée « suite réservée à un visiteur : 401 », parcours Playwright |
| Abonnement échu encore utilisé | Continuer à lire après l'échéance | L'échéance est comparée à l'horloge métier (Europe/Paris) à chaque lecture ; un abonnement échu redonne l'extrait seul | `SubscriptionApiIT` (« abonnement échu ») |
| Altération de droits | S'attribuer un numéro, prolonger un abonnement hors fenêtre, doubler un achat | Achat unique par membre et par numéro (contrainte d'unicité, 409), renouvellement limité aux 60 derniers jours (409) et sans chevauchement, formule et montant fixés côté serveur | `FanzineApiIT`, `SubscriptionApiIT`, `SubscriptionTest` |
| Élévation de privilèges | Publier un article ou lire la liste d'expédition sans être administrateur | Routes `/admin/*` : rôle `ADMIN` exigé au Gateway (`SecurityPolicy`) **et** par le service ; compte sans rôle refusé partout | `ArticleApiIT`, `SubscriptionApiIT` (403), contrôles de fumée |
| XSS stockée | Article publié avec du HTML ou du JavaScript | Texte brut, affiché comme texte par React ; CSP `script-src 'self'` ; longueurs bornées (titre 160, résumé 300, corps 20 000) | `ArticleApiIT` (validation), tests du site |
| Divulgation de l'adresse de livraison | Un membre lit l'adresse d'un autre | L'adresse n'est renvoyée qu'à son titulaire et à la liste d'expédition `ADMIN` ; aucune API ne prend d'identifiant de membre en paramètre (le membre est toujours le `subject` du jeton) | `SubscriptionApiIT` (403 sur la liste pour un client) |
| Injection SQL, énumération | Slug ou numéro forgé | Requêtes paramétrées uniquement ; slug contrôlé par expression régulière, numéros et pages bornés (400) | Tests de validation |
| Abus (volume) | Aspiration de toutes les pages par un abonné ou un robot | Limitation par IP au Gateway sur les routes membres ; métrique `pme_editorial_pages_read_total` par type d'accès (un pic de lectures sur un compte se voit) | Routes Gateway, tableau de bord « Éditions » |

**RGPD** : base légale « exécution du contrat » (achats, abonnement, livraison) ; minimisation (adresse demandée pour la formule papier seulement, aucun moyen de paiement stocké : paiement simulé dans le POC, prestataire UE en production) ; conservation : adresse de livraison effacée 90 jours après l'échéance (tâche nocturne testée, `SubscriptionApiIT`), historique des souscriptions conservé pour la comptabilité, page atteinte conservée tant que le numéro reste dans la bibliothèque ; hébergement dans l'UE (ADR-006, décision 2). **Reste à faire avant ouverture publique** : paiement réel et factures, effacement des données d'un membre à la suppression de son compte, filigrane nominatif discret des pages (dissuasion de la copie).

## 11. Administration de la boutique et inscription des clients (US18 à US20)

Demandées en recette le 19/11/2026 : l'administrateur doit pouvoir mettre en vente et approvisionner des produits, suivre les commandes de tous les clients, et un visiteur doit pouvoir créer son compte. Analyse ciblée :

| Menace | Scénario | Mesures | Preuve |
|---|---|---|---|
| Élévation de privilèges par l'inscription | Un inscrit obtient `ADMIN` ou un rôle non prévu | Rôle par défaut du royaume limité à `CUSTOMER` (plus les rôles techniques de Keycloak) ; aucun rôle ni attribut d'autorisation dans le formulaire ; `ADMIN` attribué seulement par un administrateur Keycloak | Parcours Playwright (profil « Client » après inscription), test de fumée du formulaire |
| Comptes en masse, mots de passe faibles | Robot qui crée des comptes, devinette de mot de passe | Politique de mot de passe (12 à 64 caractères, différent de l'identifiant et de l'e-mail), e-mail unique, protection contre la force brute de Keycloak ; **en production** : vérification de l'e-mail (SMTP hébergé dans l'UE), captcha et limitation de débit sur les pages de Keycloak | Configuration du royaume (`realm-pme.json`) |
| Accès aux fonctions d'administration | Un client crée un produit, réapprovisionne ou lit les commandes des autres | Rôle `ADMIN` exigé au Gateway (`SecurityPolicy` sur `catalog-admin`, `orders-admin`, `stock`) **et** dans chaque service ; 401 sans jeton | `AdminProductApiIT`, `ReservationIT`, `OrderApiIT` (403/401), contrôles de fumée, Cucumber |
| Altération du catalogue | Prix négatif ou démesuré, référence dupliquée, champs non prévus | Validation côté serveur (prix 1 centime à 10 000 €, référence au format imposé et unique, catégorie existante, longueurs bornées) ; la référence n'est jamais modifiée ; le prix d'une commande est toujours relu dans le catalogue | `AdminProductApiIT` (400, 409) |
| Répudiation | Contester une création de produit, un réapprovisionnement ou une correction d'inventaire | Chaque écriture est journalisée avec son auteur (`preferred_username`) et l'identifiant de corrélation ; métrique `pme_stock_restocked_units_total` | Journaux des services |
| Exposition de données des clients | L'administrateur ou un tiers voit plus que nécessaire | La vue d'administration ne montre que le nom affiché du compte, le contenu et le statut des commandes ; l'identifiant Keycloak n'est pas exposé ; aucun panier n'est stocké côté serveur (stockage de session du navigateur) | `OrderApiIT` (`customerId` absent) |

**RGPD** : l'inscription collecte identifiant, e-mail, prénom et nom (exécution du contrat), mot de passe haché par Keycloak ; la page « Données personnelles » du site est mise à jour. **Reste à faire avant ouverture publique** : vérification de l'e-mail et réinitialisation du mot de passe (SMTP), captcha, acceptation des conditions générales à l'inscription, suppression du compte par le client.

