# Politique de signalement des vulnérabilités

Projet pédagogique (cas fictif *La Petite Maison de l'Épouvante*). La politique complète est dans [`docs/07-politique-securite.md`](docs/07-politique-securite.md).

## Versions suivies
| Version | Correctifs de sécurité |
|---|---|
| Dernière version publiée (`main`) | Oui |
| Versions antérieures | Non |

## Signaler une vulnérabilité
- **Ne pas ouvrir d'issue publique** pour une vulnérabilité exploitable.
- Utiliser un avis de sécurité privé : onglet **Security → Report a vulnerability** du dépôt.
- Indiquer : composant, version ou commit, étapes de reproduction, impact estimé.

## Délais de traitement
| Sévérité | Prise en compte | Correction | Effet sur la livraison |
|---|---|---|---|
| Critique | 24 h | 48 h | Bloque la livraison |
| Haute | 48 h | 7 jours | Bloque la livraison |
| Moyenne | 7 jours | 30 jours | Suivie dans le backlog |
| Basse | 30 jours | 90 jours | Suivie dans le backlog |

## Détection automatisée
gitleaks (secrets), CodeQL (SAST), Trivy (dépendances, IaC, images), Dependency Review (PR), Dependabot (mises à jour), OWASP ZAP (DAST en staging).
