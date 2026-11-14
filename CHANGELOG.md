# Journal des modifications

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versionnage : [SemVer](https://semver.org/lang/fr/).

## [Non publié]

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

[Non publié]: https://github.com/mbanzaroger/petitemaisonepouvante/compare/v0.3.0...develop
[0.3.0]: https://github.com/mbanzaroger/petitemaisonepouvante/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/mbanzaroger/petitemaisonepouvante/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/mbanzaroger/petitemaisonepouvante/releases/tag/v0.1.0
