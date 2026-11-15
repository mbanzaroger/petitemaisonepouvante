# Soutenance — trame, notes et préparation des questions

> **Date** : vendredi 26/02/2027 · **Format** : 20 minutes de présentation, 15 minutes d'échange · **Public** : jury de spécialistes.
> **Support** : présentation « petitemaisonepouvante.com — V1 : processus, POC et sécurité » (17 diapositives, notes de l’orateur incluses, export PDF et PowerPoint depuis l’artefact : https://claude.ai/artifact/WYgLc9edURQJrnmwWVUho8) ; ce document en est la trame versionnée. **Démonstration** : `docs/demo/script-demo.md`.

## 1. Trame minutée (20 min)

| # | Diapositive | Durée | Message à faire passer |
|---|---|---|---|
| 1 | Titre | 0:20 | Lead Developer de la V1 : processus, POC, sécurité |
| 2 | Contexte et mission | 1:00 | Plateforme commerciale, sécurité forte, hébergement en Europe, équipe réduite ; 3 phases |
| 3 | 4 indicateurs ISO 25010 | 1:30 | Chaque indicateur est mesuré **et bloquant** : la dette ne peut pas s'accumuler en silence |
| 4 | Cycle DevSecOps | 1:30 | Sécurité à chaque étape, avec une preuve ; STRIDE dès le plan |
| 5 | Compétences et formation | 1:00 | Écart principal : DevSecOps des juniors → 2 jours + 4 semaines de binôme, évalués (Kirkpatrick) |
| 6 | Architecture du POC | 1:30 | 3 microservices, Gateway API, Keycloak, saga sur RabbitMQ, supervision |
| 7 | Expérimentations E1 à E4 | 1:30 | Chaque technologie phare adoptée **sur preuve** ; Ingress NGINX, Kafka, ELK écartés |
| 8 | Saga de commande | 1:00 | Boîte d'envoi, idempotence, file de rebut : ni perte ni double traitement |
| 9 | Pipeline CI/CD | 1:30 | CI → staging Kubernetes éphémère vérifié à chaque fusion → release sous approbation |
| 10 | Démonstration | 5:00 | Parcours US1 à US4, Grafana, test de charge et HPA en direct |
| 11 | Observabilité (US5) | 0:45 | Métriques métier, 6 alertes testées, correlationId de bout en bout |
| 12 | Charge (indicateur 3) | 0:45 | p95 7 ms au nominal ; 1 904 req/s en stress, catalogue 1 → 3 instances |
| 13 | Analyse de sécurité | 1:15 | 9 sources, 24 constats, sévérité réévaluée dans le contexte ; indicateur 4 tenu |
| 14 | Plan de remédiation | 1:00 | 12 actions justifiées, 23,5 jours, P1 avant production |
| 15 | Bilan et retours d'expérience | 0:45 | Ce que la chaîne a détecté seule ; ce que je referais |
| 16 | Questions | — | Annexe prête : les tests en chiffres (diapositive 17) ; registre et résultats bruts dans `docs/` |

Repères de temps : diapositive 9 terminée à **13:00** au plus tard ; démonstration terminée à **18:00**. En retard, raccourcir la démonstration au parcours de commande et à Grafana, et montrer le dernier run du test de charge au lieu de le lancer.

## 2. Notes par diapositive

1. **Titre** — Se présenter comme Lead Developer ; annoncer les 3 parties : processus, réalisation, remédiation.
2. **Contexte** — Reprendre les exigences du sujet : vente en ligne et diffusion, sécurité « contrainte forte », hébergement en Europe, équipe IT réduite. Le POC couvre la commande avec réservation de stock, cœur du chiffre d'affaires.
3. **Indicateurs** — Couverture ≥ 80 % (maintenabilité, fiabilité) ; dette ≤ 5 % et duplication ≤ 3 % (maintenabilité) ; p95 < 300 ms et erreurs < 1 % (performance, fiabilité) ; 0 vulnérabilité critique ou haute (sécurité). Insister : seuils **sur le code nouveau** et **bloquants** dans le pipeline. Être transparent : l'indicateur 2 attend l'activation de SonarQube Cloud (action R-08).
4. **DevSecOps** — 8 étapes (Plan → Monitor), chacune avec un outil et une preuve : STRIDE, revue et gitleaks, SAST CodeQL, SCA et scan d'image Trivy, SBOM, DAST ZAP, alertes. Politique de sécurité : délais par sévérité (48 h, 7 j, 30 j, 90 j) et exceptions datées.
5. **Compétences** — Matrice compétences × profils ; trois recrutements (front et RGAA, DevOps/SRE, référent sécurité) ; formation ciblée sur l'écart le plus risqué, mesurée jusqu'au niveau 4 (les indicateurs du projet).
6. **Architecture** — Gateway API sur Envoy Gateway (ADR-003 : Ingress NGINX retiré en mars 2026) ; JWT vérifié au Gateway **et** dans chaque service ; une base par service ; NetworkPolicies en refus par défaut ; pods non root en lecture seule.
7. **Expérimentations** — E1 Gateway + cert-manager + Keycloak (7/7) ; E2 pipeline qualité (4 dégradations bloquées sur 4) ; E3 RabbitMQ sur Kubernetes (0 perte, 0 double traitement, panne de nœud) ; E4 observabilité (alerte en 91 s sur panne réelle). Montrer qu'on a aussi **rejeté** : Kafka, ELK, Dependency-Check.
8. **Saga** — Commande PENDING écrite avec son événement dans la même transaction ; publication confirmée par le broker ; réservation tout ou rien avec verrous ordonnés ; transition PENDING → final conditionnelle, donc idempotente ; message illisible en file de rebut.
9. **Pipeline** — Actions épinglées par SHA (compromission de trivy-action en mars 2026) ; check unique « Résultat CI » ; CD en workflow réutilisable (alerte CodeQL corrigée) ; garde-fou qui vérifie que le staging tourne avec l'image du commit.
10. **Démonstration** — Suivre `docs/demo/script-demo.md`. Commenter ce que montre chaque requête (401, 403, 202, CONFIRMED, CANCELLED, 404 sur la commande d'autrui) et garder Grafana visible pendant le test de charge.
11. **Observabilité** — Le même correlationId relie 5 lignes de logs dans 2 services et 3 threads ; les alertes sont **testées unitairement** en CI avec promtool.
12. **Charge** — Bien distinguer le palier nominal (bloquant) du stress (observé). Limite assumée : générateur et cluster sur la même machine.
13. **Sécurité** — Expliquer la sévérité retenue sur un exemple : les 8 hautes d'expat et util-linux sont sans correctif et non atteignables par la JVM → exception datée, réexamen hebdomadaire. Constat né du test de charge : le catalogue n'a pas de plafond (V-11).
14. **Remédiation** — Lire le tableau par priorité : P1 bloque la production (Keycloak de production, coffre de secrets, chiffrement interne) ; chaque action a un coût, une échéance et une vérification, et une issue GitHub.
15. **Bilan** — La chaîne a détecté seule 4 défauts (alertes CodeQL, scans Trivy) et le test de l'US5 a révélé que le staging ne déployait pas l'image testée. À refaire : activer SonarQube Cloud dès le premier jour ; séparer le générateur de charge.

## 3. Questions probables et éléments de réponse

| Question | Réponse courte | Où le montrer |
|---|---|---|
| Pourquoi des microservices pour une PME ? | Domaines aux charges différentes (catalogue public très lu, commande transactionnelle) ; mise à l'échelle indépendante prouvée par le HPA ; coût de complexité accepté et encadré (ADR-001) | `docs/adr/ADR-001`, `docs/14` |
| Pourquoi une saga chorégraphiée et pas une transaction distribuée ? | Pas de 2PC entre bases ; disponibilité de la commande même broker en panne (boîte d'envoi) ; idempotence prouvée par E3 et par les tests | `docs/03`, E3 |
| Pourquoi RabbitMQ plutôt que Kafka ? | Besoin de files de travail avec accusés, rebut et nouvelles tentatives, pas d'un journal rejouable ; opérateur Kubernetes mûr ; coût d'exploitation | E3, synthèse |
| Comment évitez-vous la dette technique ? | Indicateurs bloquants sur le code nouveau, revue de PR, Dependabot hebdomadaire, rapport de sécurité hebdomadaire, ADR | `docs/04`, `docs/10` |
| Que se passe-t-il si RabbitMQ tombe ? | Les commandes restent acceptées (202) et stockées dans la boîte d'envoi ; alerte `BoiteEnvoiBloquee` en 2 min ; publication au retour du broker | `docs/12` §5 |
| Pourquoi le JWT est-il vérifié deux fois ? | Défense en profondeur : un service joignable sans passer par le Gateway (erreur de NetworkPolicy) reste protégé | `docs/01` |
| Pourquoi pas de front-end ? | ADR-002 : effort porté sur sécurité, saga, déploiement et charge ; le client OIDC PKCE est prêt ; RGAA et CSP sont au plan | ADR-002 |
| Comment passeriez-vous en production ? | Overlay de production, Keycloak en mode `start` avec PostgreSQL, coffre de secrets UE, mTLS, signature des images ; `release.yml` déploie après approbation | `docs/11` (P1), `release.yml` |
| Vos chiffres de charge sont-ils réalistes ? | Ordre de grandeur pessimiste : tout tourne sur 4 vCPU ; marge de 40 fois sur le seuil au nominal ; endurance et générateur séparé planifiés (R-12) | `docs/14` §4 |
| Pourquoi accepter 8 vulnérabilités hautes ? | Aucun correctif publié ; composants non atteignables par la JVM ; conteneur non root, lecture seule, sans shell ; réexamen hebdomadaire et livraison sous 7 j dès qu'un correctif sort | `docs/13` V-01 |
| Comment avez-vous piloté le projet ? | Jalons J0 à J5 avec rétroplanning, kanban, issues et PR systématiques, releases versionnées, audit à mi-parcours ; jalons tenus avec plusieurs semaines d'avance | `docs/suivi-avancement.md`, `docs/audit/` |

## 4. Avant le jour J

- [ ] Publier les releases en attente (v0.5.0, v0.6.0, puis v1.0.0).
- [ ] Activer SonarQube Cloud (#32) pour présenter l'indicateur 2 mesuré.
- [ ] Deux répétitions chronométrées (#41), la seconde devant un tiers qui pose les questions du §3.
- [ ] Enregistrer la vidéo de secours de la démonstration complète (#41) et la garder hors ligne.
- [ ] La veille : lancer le CD staging avec la case « charge » pour disposer d'un run de référence récent.
