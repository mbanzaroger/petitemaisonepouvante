# Journal des modifications

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versionnage : [SemVer](https://semver.org/lang/fr/).

## [Non publié]
### Ajouté
- **Recommandations** (US13) : sélection « Recommandé pour vous » sur le catalogue et « Vous aimerez aussi » sur les fiches, selon les recherches, consultations et achats du membre, avec la raison affichée ; consentement dans « Mon espace » (désactivé par défaut), effacement de l'historique, conservation 90 jours ; sélection commune pour les visiteurs.
- **Gamme exclusive Evil Ed** : produits signalés « Exclusivité Evil Ed », filtre du catalogue, mise en avant dans les recommandations.
- **Notifications selon la navigation** (US14) : un membre qui l'accepte est prévenu des nouvelles annonces de troc dans les catégories qu'il consulte souvent ; centres d'intérêt effacés au retrait de l'accord, conservés 180 jours.
- **Actualités et articles de fond** (US15, ADR-006) : pages « Actualités » ouvertes à tous (filtre actualités / articles de fond, article complet) ; page « Rédaction » (ADMIN) pour publier ou retirer un texte.
- **Fanzine numérique** (US16) : numéros parus avec extrait gratuit, achat à l'unité, liseuse intégrée (une page à la fois, sommaire, flèches du clavier, page atteinte mémorisée), « Ma bibliothèque » dans « Mon espace ».
- **Abonnement au fanzine** (US17) : formules numérique ou papier et numérique (adresse de livraison), renouvellement dans les 60 jours précédant l'échéance, liste d'expédition des abonnés papier (ADMIN) ; adresse effacée 90 jours après l'échéance (RGPD).
- Nouveau service `editorial-service` (Spring Boot 4.1, PostgreSQL `editorial`, port 8085) : routes Gateway (lecture publique, membres JWT, rédaction ADMIN, limitation par IP), NetworkPolicies, base de staging, secrets générés, ServiceMonitor ; métriques `pme_editorial_*`, panneaux Grafana « Éditions ».
- Qualité : 27 tests du service (13 d'intégration Testcontainers), 4 scénarios Cucumber à travers le Gateway, 10 contrôles de fumée, parcours Playwright + axe (actualités, extrait, achat et liseuse, abonnement, rédaction), contrat OpenAPI des 15 routes éditoriales.
- ADR-006 : service éditorial, hébergement en Europe (fournisseur, bases, sauvegardes, registre, CI sans données réelles) et feuille de route (enchères et diffusion Evil Ed en v2, projections du festival en v3).

### Corrigé
- Staging : `community-service` et `editorial-service` autorisés à lire les clés JWKS de Keycloak (NetworkPolicy) ; les routes authentifiées de la communauté répondaient 504.
- Image du site : 5 CVE hautes de nginx 1.30.6 (publiées le 18/11/2026, code non atteint par notre configuration) en exception datée jusqu'au 26/11/2026 (V-28) ; le Dockerfile installe nginx 1.30.7 depuis le dépôt officiel nginx.org (clé vérifiée) dès sa publication pour Alpine.
- Supervision : `verify.sh` calcule les cibles, alertes et panneaux attendus depuis le dépôt (les valeurs figées dataient d'avant l'espace communautaire).

## [1.3.0] - 2026-11-18
### Ajouté
- **Espace communautaire** (US8 à US12, ADR-004) : nouveau service `community-service` (Spring Boot 4.1, PostgreSQL `community`, port 8084) et pages du site :
  - troc et dons entre particuliers : annonces publiques filtrables, publication, retrait, proposition d'échange ou demande de don, acceptation, refus, annulation ;
  - conversation privée entre les deux membres d'une proposition, salons de discussion thématiques (relevé périodique par curseur, ADR-005), anti-flood (5 messages / 10 s) ;
  - « Mon espace » : notifications (pastille dans l'en-tête), préférences de notification, objets recherchés avec alerte à la publication d'une annonce correspondante, mes annonces ;
  - signalement par les membres et page « Modération » (ADMIN) : masquer un contenu (auteur prévenu) ou rejeter le signalement ;
  - conservation RGPD (notifications lues 90 jours, messages de salon 365 jours).
- Plateforme : routes Gateway (lecture publique des annonces, membres CUSTOMER/ADMIN, modération ADMIN, limitation par IP), NetworkPolicies dédiées, base de staging, secrets générés, ServiceMonitor ; métriques `pme_community_*`, alerte `ModerationEnAttente`, panneaux Grafana.
- Qualité : 41 tests du service (25 d'intégration Testcontainers), scénarios Cucumber US8 à US12, contrôles de fumée, parcours Playwright + axe (troc complet, salon, modération), page « Troc et dons » auditée par Lighthouse.
- `infra/init-env.sh` complète un `infra/.env` existant avec les variables manquantes (ex. `COMMUNITY_DB_PASSWORD`) sans changer les autres valeurs.
- Script de diagnostic de l'environnement local (`infra/diagnostic.sh`) : configuration, conteneurs, adresses Keycloak, émetteur attendu par les services, santé, jetons refusés.
- Mode GitHub Codespaces (`infra/codespaces.sh`) : le site est servi sur l'adresse publique du Codespace et Keycloak est relayé sur la même origine ; adresses paramétrées par `PME_SITE_URL` et `KEYCLOAK_PUBLIC_URL` (valeurs locales inchangées par défaut).

### Corrigé
- En local, le site démarre même si un service n'est pas encore joignable (résolution DNS à la demande, #105).
- Site : le compte connecté et son profil sont affichés clairement dans l'en-tête ; un échec de connexion est signalé par un bandeau au lieu d'un retour silencieux en mode déconnecté ; le panier explique pourquoi un compte non client ne peut pas commander (avec « Changer de compte ») et propose de se reconnecter quand la session a expiré.

## [1.2.0] - 2026-11-17
### Ajouté
- Espace administrateur (#100) : page « Stock » réservée au rôle ADMIN, niveaux lus en direct, filtre des produits à surveiller ; route stock ouverte sur `app.pme.local` (JWT + ADMIN au Gateway).
- Pages de conformité : plan du site, déclaration d'accessibilité (non conforme tant que l'audit R-13 n'est pas réalisé), mentions légales, données personnelles et cookies ; pied de page dédié.
- Thème de connexion Keycloak « pme » aux couleurs du site, en français (docker compose et staging).
- Panier revalidé à l'ouverture (prix et disponibilité) ; filet d'erreur ; pages chargées à la demande.
- Observabilité du site : journaux nginx JSON sans adresse IP, `X-Correlation-Id` envoyé par le navigateur et affiché en cas d'erreur, exporteur nginx (sidecar), ServiceMonitor, 3 panneaux Grafana, contrôles US5.
- CI : budget de poids du bundle ; CD : Lighthouse (bureau) avec seuils sur 3 pages, 10 tests Playwright, axe sur 14 pages dont la connexion.

### Modifié
- Alerte `ServiceIndisponible` étendue au site ; `verify.sh` attend 5 cibles et 14 panneaux.
- « Mes commandes » n'apparaît plus qu'aux clients ; CLS corrigé (gouttière de défilement, place du bouton de connexion).

## [1.1.0] - 2026-11-16
### Ajouté
- Site web `web-frontend` (#92, ADR-002 révisé) : SPA React 19 + TypeScript — catalogue filtrable et paginé, fiche produit, panier, connexion Keycloak (code + PKCE S256, jetons en mémoire), commande, suivi en direct du statut de la saga, historique.
- Accessibilité (RGAA 4.1) : lien d'évitement, titre et focus à chaque navigation, zones de statut, tableaux et formulaires étiquetés, contrastes vérifiés ; `eslint-plugin-jsx-a11y` strict.
- Image nginx non root en lecture seule, `config.json` par environnement ; service `web-frontend` dans docker compose (http://localhost:5173).
- Kubernetes : site sur `app.pme.local` derrière le Gateway, même origine que l'API ; NetworkPolicy sans sortie.
- CI : job « Front-end » (lint, types, 67 tests Vitest, couverture ≥ 80 %) et image `web-frontend` (Trivy, SBOM, GHCR).
- CD : tests de bout en bout Playwright et contrôles axe sur le staging ; baseline ZAP du site (`.zap/rules-site.tsv`).

### Modifié
- ADR-002 révisé : le front-end minimal remplace la démonstration par l'API seule.
- Royaume `pme` : redirections du client `pme-web` pour le port 8443, retour après déconnexion, pages de connexion en français.
- Release et rapport de sécurité hebdomadaire : image `web-frontend` incluse ; Dependabot : npm et image du site.

### Sécurité
- CSP stricte sans script ni style en ligne, `frame-ancestors 'none'`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, COOP et CORP sur le site ; aucun jeton dans le stockage du navigateur.

## [1.0.0] - 2026-11-15
### Ajouté
- Trame de soutenance minutée, notes et questions probables (`docs/soutenance/support.md`) ; support de présentation (#40).

### Modifié
- Script de démonstration : test de charge sous Grafana, correlationId, HPA, vérification de la supervision.
- Suivi d'avancement : J3 et J4 terminés le 15/11/2026, point d'avancement et écarts.
- CD staging : attente du Gateway portée à 6 minutes, état du Gateway affiché en cas d'échec.

## [0.6.0] - 2026-11-15
### Ajouté
- Test de charge JMeter du catalogue et de la commande, paliers nominal et de stress, HPA et metrics-server en staging, panneau Grafana des instances (#36, `docs/14-test-de-charge.md`).
- DAST : scan actif de l'API à partir du contrat OpenAPI, authentifié ; qualification des alertes ZAP dans `.zap/rules.tsv` (#37).
- Rapport de sécurité hebdomadaire (Trivy images toutes sévérités, configuration Kubernetes rendue) ; analyse de sécurité de la V1 et registre de 24 constats (#38, `docs/13-analyse-securite.md`).
- Plan de remédiation priorisé et justifié, issues #73 à #83 (#39, `docs/11-plan-remediation.md`).

### Modifié
- CD staging : entrée « charge », file d'attente par branche, DAST par `scripts/dast.sh`.
- Royaume de staging : jetons de 15 minutes pour le client de test.

### Sécurité
- En-têtes HSTS et Cross-Origin-Resource-Policy ajoutés au Gateway ; réponse 404 de repli avec en-têtes de sécurité.
- Console d'administration Keycloak et royaume `master` retirés de la route publique.
- Identifiant client (pseudonyme) dans le journal de création de commande (non-répudiation).

## [0.5.0] - 2026-11-15
### Ajouté
- US1 à US4 : catalogue public, authentification Keycloak (JWT vérifié au Gateway et dans les services), commande par saga chorégraphiée order ↔ stock (outbox, idempotence, DLQ), historique par propriétaire (#25 à #28).
- US5 : métriques métier de la saga, tableau de bord Grafana RED + saga, 6 règles d'alerte avec tests `promtool`, correlationId de bout en bout (#29, `docs/12-observabilite.md`).
- Staging Kubernetes : Kustomize, Gateway API (Envoy Gateway, TLS cert-manager, JWT, limitation de débit), NetworkPolicies, supervision kube-prometheus-stack (#31).
- Tests d'acceptation Cucumber en français exécutés contre le staging (#30).
- Infrastructure locale durcie et complète (docker compose, secrets générés) (#33).
- ADR-002 (front-end hors POC), contrat OpenAPI, collection Bruno, script de démonstration (#34, #35).

### Modifié
- `cd.yml` devient un workflow réutilisable appelé par `ci.yml` (suppression de `workflow_run`, alertes CodeQL « cache poisoning »).

### Corrigé
- Le staging déployait l'image `:develop` au lieu de celle du commit (surcharge Kustomize mal ciblée) ; garde-fou ajouté dans le CD.
- Mots de passe générés du staging corrompus par la commande de masquage GitHub.

## [0.4.0] - 2026-11-14
### Ajouté
- Squelettes Spring Boot 4.1 / Java 21 des 3 services : Actuator, Flyway, tests unitaires et Testcontainers, JaCoCo ≥ 80 %, images distroless non root (#24).
- Expérimentations reproductibles sur kind, avec workflow et protocole : E1 Gateway API + cert-manager + Keycloak (#18), E2 pipeline qualité (#19), E3 RabbitMQ (#20), E4 observabilité (#21) ; synthèse adoption/rejet (#22).
- ADR-003 : Gateway API (Envoy Gateway) à la place d'Ingress NGINX, retiré en mars 2026.
- Rétroplanning jusqu'à la soutenance du 26/02/2027 et échéances des jalons J2 à J5 (#23).
- Détection du jeton limité des Codespaces dans les scripts de configuration.

## [0.3.0] - 2026-11-14
### Ajouté
- Pipelines GitHub Actions : CI (secrets, build et tests, SonarCloud, Trivy, SBOM, publication GHCR), CodeQL, CD (staging sur cluster Kubernetes éphémère, DAST ZAP, production avec approbation), release.
- Gouvernance du dépôt : modèle de branches, conventions de commit, modèles d'issues et de PR, CODEOWNERS, `SECURITY.md`, Dependabot.
- Script de configuration GitHub (`scripts/bootstrap/`) : labels, jalons, issues, kanban, environnements, protection de branches, releases.
- Audit du projet au 14/11/2026 (`docs/audit/`).
- Document de gouvernance du dépôt (`docs/10-gouvernance-depot.md`).

## [0.2.0] - 2026-10-10
### Ajouté
- Phase 1 : indicateurs qualité ISO 25010, cycle DevSecOps et STRIDE, politique de tests, politique de sécurité, cartographie des compétences, action de formation.

## [0.1.0] - 2026-10-10
### Ajouté
- Cadrage technique v1.0, ADR-001 (microservices), schémas d'architecture, de CI/CD et de saga, backlog US1 à US5.
- Infrastructure locale de développement (docker-compose) et squelette de CI.

[Non publié]: https://github.com/mbanzaroger/petitemaisonepouvante/compare/v1.2.0...develop
[1.2.0]: https://github.com/mbanzaroger/petitemaisonepouvante/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/mbanzaroger/petitemaisonepouvante/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/mbanzaroger/petitemaisonepouvante/compare/v0.6.0...v1.0.0
[0.6.0]: https://github.com/mbanzaroger/petitemaisonepouvante/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/mbanzaroger/petitemaisonepouvante/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/mbanzaroger/petitemaisonepouvante/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/mbanzaroger/petitemaisonepouvante/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/mbanzaroger/petitemaisonepouvante/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mbanzaroger/petitemaisonepouvante/releases/tag/v0.1.0
