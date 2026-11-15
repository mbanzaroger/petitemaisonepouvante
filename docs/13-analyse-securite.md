# 13 — Analyse de sécurité de la V1

> **Issue** : #38 · **Date** : 15/11/2026 · **Périmètre** : les 3 services, le Gateway (Envoy Gateway), Keycloak, RabbitMQ, PostgreSQL, le staging Kubernetes et la chaîne CI/CD.
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
| DAST | OWASP ZAP baseline (passif) + scan actif de l'API depuis le contrat OpenAPI, authentifié | Staging déployé | Chaque déploiement | Après corrections : 0 échec, 0 avertissement ; 120 règles passées sur l'API (V-03, V-04) |
| Charge et volume | JMeter : palier nominal et palier de stress | Staging déployé | À la demande | p95 7 ms au nominal ; 1 904 req/s acceptées sans plafond sur le catalogue (V-11) |
| Qualité | SonarQube Cloud | Code des services | Chaque PR | Inactif, en attente du jeton (V-20) |
| Revue manuelle | Modèle STRIDE (`docs/05`), configuration, pipeline | Ensemble du système | Jalon J4 | Constats V-02, V-10, V-12 à V-14, V-17 à V-19, V-23, V-24 |

**Rapport consolidé** : le workflow « Rapport de sécurité » (`.github/workflows/security-report.yml`) relance chaque lundi les scans des images (toutes sévérités, avec ou sans correctif) et de la configuration Kubernetes rendue. Il complète la CI, réglée pour ne bloquer que ce qui est corrigeable.

## 2. Synthèse

Décompte par sévérité **retenue** (après réévaluation dans le contexte, voir §3) :

| Statut | Critique | Haute | Moyenne | Basse | Total |
|---|---|---|---|---|---|
| Corrigé ou évité | 2 | 3 | 3 | 2 | 10 |
| Exception datée ou risque accepté | — | — | 1 | 3 | 4 |
| À traiter (plan de remédiation) | — | 1 | 7 | 2 | 10 |
| **Total** | **2** | **4** | **11** | **7** | **24** |

**Indicateur 4** (`docs/04`) : **0 vulnérabilité critique ou haute corrigeable non traitée**. Le seul constat de sévérité haute encore ouvert (V-17) ne concerne que la future production : il est bloquant pour la mise en production et planifié en priorité 1. Les 8 vulnérabilités hautes du système de base (V-01) n'ont pas de correctif publié ; elles relèvent d'une exception justifiée, conformément à la politique de sécurité (§6).

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
