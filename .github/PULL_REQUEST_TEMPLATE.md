## Objet
<!-- Ce que change cette PR, en une ou deux phrases. -->

Closes #

## Type
- [ ] Fonctionnalité (user story)
- [ ] Correction
- [ ] Expérimentation
- [ ] CI/CD, infrastructure
- [ ] Documentation

## Definition of Done
- [ ] Critères d'acceptation de l'issue automatisés et verts
- [ ] Tests unitaires et d'intégration ajoutés ; couverture du code nouveau ≥ 80 %
- [ ] Quality Gate SonarCloud passé (dette ≤ 5 %, duplication ≤ 3 %)
- [ ] Aucune vulnérabilité critique ou haute (Trivy, CodeQL), aucun secret (gitleaks)
- [ ] Endpoint protégé testé en 401 et 403
- [ ] Métriques exposées (`/actuator/prometheus`) et logs avec `correlationId`
- [ ] Documentation et `CHANGELOG.md` à jour

## Grille de revue sécurité
- [ ] Entrées validées, requêtes SQL paramétrées
- [ ] Rôles vérifiés côté serveur, accès limité au propriétaire de la ressource
- [ ] Aucune donnée sensible dans les logs (jeton, mot de passe)
- [ ] Prix et montants relus côté serveur, jamais pris du client
- [ ] Nouvelles dépendances justifiées et à jour

## Preuves
<!-- Captures, extraits de logs, lien vers le run CI. -->
