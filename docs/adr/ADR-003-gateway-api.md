# ADR-003 — Gateway API (Envoy Gateway) à la place d'Ingress NGINX

- **Statut** : accepté (14/11/2026, à l'issue de l'expérimentation E1)
- **Contexte** : le cadrage v1.0 prévoyait Ingress NGINX comme point d'entrée du cluster. Le projet communautaire Ingress NGINX a été retiré en mars 2026 : dépôt archivé, plus aucun correctif de sécurité. La plateforme est commerciale et la sécurité est une contrainte forte.
- **Décision** : exposer les services par **Gateway API** implémentée par **Envoy Gateway**. Le Gateway termine le TLS (certificats cert-manager), vérifie les jetons Keycloak (`SecurityPolicy` : signature, émetteur, audience, rôle) et portera la limitation de débit (`BackendTrafficPolicy`).
- **Conséquences positives** : API standard et portable entre implémentations ; séparation des rôles (le `Gateway` pour l'exploitation, les `HTTPRoute` pour les équipes de développement) ; contrôle d'accès dès l'entrée, en plus de la validation par chaque service (défense en profondeur).
- **Conséquences négatives** : CRD supplémentaires à maintenir ; politiques de sécurité spécifiques à Envoy Gateway (`SecurityPolicy` n'est pas dans le standard Gateway API).
- **Alternatives** :
  - Ingress NGINX : rejeté (retiré, sans correctifs).
  - NGINX Ingress Controller de F5 : maintenu, mais reste sur l'API Ingress et ses annotations propriétaires.
  - Traefik : implémente aussi Gateway API ; écarté au profit d'Envoy Gateway pour la validation JWT et l'autorisation par revendications intégrées.
- **Preuves** : `docs/experimentations/E1.md`, run 43605318318.
