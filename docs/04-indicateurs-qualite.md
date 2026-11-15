# Indicateurs qualité (ISO 25010) et lutte contre la dette technique

| # | Indicateur | Caractéristique ISO 25010 | Seuil (Quality Gate) | Outil | Étape pipeline |
|---|---|---|---|---|---|
| 1 | Couverture de tests du code métier | Maintenabilité, fiabilité | ≥ 80 % | JaCoCo (contrôlé en CI) + SonarQube Cloud | Tests unitaires |
| 2 | Ratio de dette technique, duplication, complexité cognitive | Maintenabilité | dette ≤ 5 %, duplication ≤ 3 % | SonarQube | Analyse statique |
| 3 | Latence p95 et taux d'erreur sous charge | Performance, fiabilité | p95 < 300 ms, erreurs < 1 % | JMeter + Prometheus | Test de charge |
| 4 | Vulnérabilités critiques/hautes non traitées | Sécurité | 0 | Trivy, CodeQL, ZAP | Scans |

## Mesures au 15/11/2026 (jalon J4)

| # | Mesure | Statut | Preuve |
|---|---|---|---|
| 1 | Couverture des lignes ≥ 80 % sur les 3 services, contrôlée à chaque build | ✅ tenu | Job « Build et tests », résumé « Indicateur 1 » |
| 2 | Non mesuré : SonarQube Cloud en attente du jeton | 🟡 en attente | Issue #32, action R-08 du plan de remédiation |
| 3 | Palier nominal : p95 **7 ms**, **0 %** d'erreurs (63 req/s) ; stress : p95 93 ms, 0 % à 1 904 req/s | ✅ tenu | `docs/14-test-de-charge.md` |
| 4 | **0** vulnérabilité critique ou haute corrigeable non traitée ; 8 hautes sans correctif du système de base sous exception datée | ✅ tenu | `docs/13-analyse-securite.md` |

## Pourquoi ces indicateurs limitent la dette technique
- **Seuils bloquants** : un build qui dégrade un indicateur échoue ; la dette ne peut pas s'accumuler silencieusement.
- **Quality Gate sur le code nouveau** : le code ajouté doit respecter les seuils, même si l'historique est imparfait.
- **Tendance dans le temps** : Sonar et Grafana conservent l'historique ; une dérive est visible avant d'être coûteuse.
- **Dette de sécurité traitée comme une dette** : toute vulnérabilité critique/haute bloque la livraison ou fait l'objet d'une exception documentée et datée.
