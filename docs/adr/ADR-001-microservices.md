# ADR-001 — Architecture microservices

- **Statut** : accepté (cadrage v1.0 validé le 10/10/2026)
- **Contexte** : plateforme e-commerce à vocation commerciale, roadmap V2 (enchères, diffusion Evil Ed) et V3 (festival en ligne), équipe répartissable par domaine, hébergement UE.
- **Décision** : découpage par contextes métier (catalogue, commande, stock), une base par service, communication REST + RabbitMQ.
- **Conséquences positives** : mise à l'échelle ciblée (catalogue en lecture), évolutions V2/V3 sans refonte du cœur, démonstration de l'orchestration et de la résilience.
- **Conséquences négatives** : complexité opérationnelle, cohérence éventuelle des données, observabilité indispensable.
- **Parades** : 3 services seulement pour le POC, saga idempotente, contrats d'API versionnés, CI/CD et observabilité dès le premier jour.
- **Alternative écartée** : monolithe modulaire (plus simple, mais ne démontre ni orchestration ni montée en charge ciblée).
- **CI/CD** : GitHub Actions retenu (le dépôt est hébergé sur GitHub), registre d'images GHCR.
