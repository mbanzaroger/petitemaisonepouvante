# Indicateurs qualité (ISO 25010) et lutte contre la dette technique

| # | Indicateur | Caractéristique ISO 25010 | Seuil (Quality Gate) | Outil | Étape pipeline |
|---|---|---|---|---|---|
| 1 | Couverture de tests du code métier | Maintenabilité, fiabilité | ≥ 80 % | JaCoCo + SonarQube | Tests unitaires |
| 2 | Ratio de dette technique, duplication, complexité cognitive | Maintenabilité | dette ≤ 5 %, duplication ≤ 3 % | SonarQube | Analyse statique |
| 3 | Latence p95 et taux d'erreur sous charge | Performance, fiabilité | p95 < 300 ms, erreurs < 1 % | JMeter + Prometheus | Test de charge |
| 4 | Vulnérabilités critiques/hautes non traitées | Sécurité | 0 | Trivy, Dependency-Check, ZAP | Scans |

## Pourquoi ces indicateurs limitent la dette technique
- **Seuils bloquants** : un build qui dégrade un indicateur échoue ; la dette ne peut pas s'accumuler silencieusement.
- **Quality Gate sur le code nouveau** : le code ajouté doit respecter les seuils, même si l'historique est imparfait.
- **Tendance dans le temps** : Sonar et Grafana conservent l'historique ; une dérive est visible avant d'être coûteuse.
- **Dette de sécurité traitée comme une dette** : toute vulnérabilité critique/haute bloque la livraison ou fait l'objet d'une exception documentée et datée.
