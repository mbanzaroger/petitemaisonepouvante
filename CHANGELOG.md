# Journal des modifications

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versionnage : [SemVer](https://semver.org/lang/fr/).

## [Non publié]

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

[Non publié]: https://github.com/mbanzaroger/petitemaisonepouvante/compare/v1.0.0...develop
[1.0.0]: https://github.com/mbanzaroger/petitemaisonepouvante/compare/v0.6.0...v1.0.0
[0.6.0]: https://github.com/mbanzaroger/petitemaisonepouvante/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/mbanzaroger/petitemaisonepouvante/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/mbanzaroger/petitemaisonepouvante/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/mbanzaroger/petitemaisonepouvante/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/mbanzaroger/petitemaisonepouvante/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mbanzaroger/petitemaisonepouvante/releases/tag/v0.1.0
