# ADR-002 — Périmètre du front-end pour le POC

- **Statut** : accepté (14/11/2026, constat A9 de l'audit)
- **Contexte** : l'architecture cible comprend une SPA `web-frontend` (OIDC code + PKCE, RGAA). Les consignes demandent au minimum **une** fonctionnalité métier, démontrée par des tests d'appels ou d'acceptation, avec pipeline CI/CD, orchestrateur, sécurité et observabilité. Le temps restant (15 semaines) est consacré à la profondeur de ces exigences plutôt qu'à l'interface.
- **Décision** : le POC est démontré **par l'API**, à travers le Gateway (TLS + JWT), avec :
  - le contrat OpenAPI `docs/api/openapi.yaml` ;
  - la collection Bruno `docs/api/bruno/` (parcours US1 à US4, cas 401/403/404) ;
  - les tests d'acceptation Cucumber en français (`acceptance-tests/`) exécutés sur staging.
  La SPA reste dans l'architecture cible (roadmap V1 commerciale) ; le client Keycloak `pme-web` (code + PKCE S256, origines restreintes) est déjà configuré pour elle.
- **Conséquences positives** : effort concentré sur la sécurité, la saga, le déploiement et la charge ; démonstration reproductible et sans « effet démo » d'interface ; contrat d'API documenté et testé.
- **Conséquences négatives** : l'accessibilité (RGAA) et la sécurité navigateur (CSP, stockage des jetons) ne sont pas démontrées ; elles figurent au plan de remédiation et à la roadmap.
- **Alternatives écartées** : SPA minimale (catalogue + commande) : 2 à 3 semaines pour une valeur faible au regard des critères d'évaluation ; Swagger UI embarquée dans les services : surface d'attaque supplémentaire en production.
