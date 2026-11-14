# Synthèse des expérimentations (jalon J2)

Quatre expérimentations en bac à sable, chacune reproductible par un script et un workflow GitHub Actions sur un cluster Kubernetes éphémère (kind). Elles portent sur les **plateformes** dont dépend le POC (point d'entrée, identité, messagerie, observabilité, chaîne qualité), conformément aux consignes.

| | E1 — Exposition sécurisée | E2 — Pipeline qualité | E3 — Messagerie | E4 — Observabilité |
|---|---|---|---|---|
| **Technologies** | Gateway API (Envoy Gateway 1.10), cert-manager 1.21, Keycloak 26.8 | JaCoCo, Testcontainers, Trivy, gitleaks | RabbitMQ 4.3 (opérateur, 3 nœuds, files quorum) | Prometheus Operator, Alertmanager, Grafana, Micrometer |
| **Hypothèse** | OIDC et TLS automatisé s'intègrent ; l'API est protégée dès l'entrée | Le pipeline bloque un livrable non conforme | Aucune perte, aucun double traitement | Une panne est détectée et une requête est traçable |
| **Résultat clé** | 7/7 : 401, 403, 200 selon le jeton ; TLS 1.3 vérifié ; certificat renouvelé automatiquement | 4/4 dégradations bloquées (couverture 52 %, CVE critique, image vulnérable, secret) | 200 événements uniques malgré 21 doublons ; 4 000/4 000 messages après panne et redémarrage | Alerte en 91 s sur panne de base, résolue en 10 s ; tableau de bord provisionné ; logs corrélés |
| **Difficulté principale** | Ingress NGINX retiré (mars 2026) | Image distroless Debian 12 non maintenue | Message illisible en boucle avec remise en file | `runAsNonRoot` refusé avec un utilisateur nommé |
| **Décision** | Adopter Gateway API + Envoy Gateway (ADR-003), cert-manager, Keycloak | Adopter ; rejeter Dependency-Check | Adopter RabbitMQ quorum ; écarter Kafka | Adopter ; écarter ELK pour le POC |
| **Run** | [43605318318](https://github.com/mbanzaroger/petitemaisonepouvante/actions/runs/43605318318) | [43604901970](https://github.com/mbanzaroger/petitemaisonepouvante/actions/runs/43604901970) | [43608084946](https://github.com/mbanzaroger/petitemaisonepouvante/actions/runs/43608084946) | [43607558204](https://github.com/mbanzaroger/petitemaisonepouvante/actions/runs/43607558204) |

## Technologies rejetées et pourquoi
| Technologie | Raison du rejet | Source |
|---|---|---|
| Ingress NGINX | Projet retiré en mars 2026, plus aucun correctif de sécurité | E1, ADR-003 |
| OWASP Dependency-Check | Inutilisable sans clé NVD (HTTP 429), lent ; Trivy couvre dépendances, images et IaC | E2 |
| distroless Debian 12 | Branche plus reconstruite, 10 vulnérabilités critiques/hautes corrigeables | E2 |
| Kafka | Pas de rejet message par message ni de DLQ natifs ; débit surdimensionné pour le besoin | E3 |
| ELK | Coût mémoire élevé pour un besoin couvert par métriques + logs corrélés ; Loki si besoin | E4 |

## Ce que les expérimentations ont changé dans le code
- **Services** : image `distroless/java21-debian13`, utilisateur numérique `65532`, histogrammes de latence activés.
- **Saga** : publication avec confirmations et boîte d'envoi transactionnelle ; `eventId` enregistré dans la même transaction que la réservation ; message illisible rejeté sans remise en file (DLQ) ; files quorum.
- **Sécurité** : contrôle du jeton au Gateway **et** dans chaque service (défense en profondeur) ; émetteur et audience `pme-api` vérifiés.
- **Politique de sécurité** : règles « image de base issue d'une branche maintenue » et « aucun composant en fin de vie ».
- **Pipeline** : actions épinglées par SHA, scan IaC limité aux manifestes livrés, faux positif gitleaks qualifié dans `.gitleaksignore`.

## Méthode commune
Chaque protocole (`E1.md` à `E4.md`) suit la même trame : hypothèse, critère de succès mesurable, environnement, étapes reproductibles, résultats chiffrés, difficultés, limites, décision. Les secrets de test sont générés à l'exécution, les preuves (certificats, jetons décodés, inventaires, durées) sont jointes en artefact de chaque run.
