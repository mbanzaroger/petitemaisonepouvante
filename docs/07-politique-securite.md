# Politique de sécurité

La plateforme est à visée commerciale : la sécurité est une contrainte forte. Principes directeurs : **défense en profondeur**, **moindre privilège**, **sécurité par défaut**, **zéro secret dans le code**. Référentiels : OWASP Top 10 et OWASP ASVS (niveau 2 visé).

## 1. Identité et contrôle d'accès
| Rôle | Droits |
|---|---|
| Visiteur (anonyme) | Lecture du catalogue |
| `CUSTOMER` | Passer des commandes, consulter **ses** commandes |
| `MODERATOR` | Modérer l'espace communautaire (roadmap) |
| `ADMIN` | Gestion du catalogue et du stock |

- Authentification : OIDC (flux code + PKCE) via Keycloak ; pas d'authentification maison.
- Chaque service valide le JWT (signature par JWKS, expiration, audience) et applique les rôles **côté serveur**.
- Mots de passe : politique Keycloak (longueur, blocage après échecs), MFA proposé pour `ADMIN`.

## 2. Protection des échanges et des données
- TLS 1.2+ partout où c'est exposé ; certificats automatisés par cert-manager ; HSTS.
- Chiffrement au repos des volumes et des Secrets Kubernetes.
- Requêtes SQL paramétrées uniquement ; validation stricte des entrées ; échappement des sorties.
- En-têtes de sécurité (CSP, X-Content-Type-Options, X-Frame-Options) ; CORS restreint au domaine de l'application.
- **Paiement** : externalisé à un prestataire certifié (le service ne stocke aucune donnée de carte) ; hors périmètre du POC.

## 3. Secrets
- Aucun secret dans le dépôt (gitleaks en pre-commit et en CI).
- Secrets injectés à l'exécution (Secrets Kubernetes) ; rotation planifiée ; identifiants de développement distincts de ceux de production.

## 4. Réseau et conteneurs
- NetworkPolicies en **deny-all** par défaut, flux explicitement autorisés ; bases de données non exposées hors cluster.
- Images minimales, utilisateur non root, système de fichiers en lecture seule quand possible, limites CPU/mémoire, pas de conteneur privilégié.
- Rate limiting à l'Ingress contre le brute force et le déni de service.

## 5. Chaîne d'approvisionnement logicielle
- Dépendances figées ; mises à jour automatisées (Dependabot ou Renovate) ; SCA et scan d'image à chaque build ; SBOM généré à chaque release.
- Images issues de sources officielles ; tag immuable par SHA de commit.

## 6. Gestion des vulnérabilités
| Sévérité | Délai de traitement | Effet sur la livraison |
|---|---|---|
| Critique | 48 h | Bloque la livraison |
| Haute | 7 jours | Bloque la livraison |
| Moyenne | 30 jours | Suivie dans le backlog |
| Basse | 90 jours | Suivie dans le backlog |

Une **exception** (faux positif ou absence de correctif) exige : justification écrite, mesure compensatoire, date de réexamen, validation du Lead Developer.

## 7. Journalisation et détection
- Journaux structurés JSON avec `correlationId` et identifiant utilisateur (pseudonymisé).
- Événements de sécurité tracés : échecs d'authentification, 401/403, changements de rôle.
- Aucune donnée sensible (mot de passe, jeton, données de carte) dans les journaux.
- Alertes Prometheus/Grafana sur pics d'erreurs 401/403 et de latence.

## 8. Données personnelles (RGPD)
- Minimisation des données collectées ; finalité et durée de conservation documentées ; registre des traitements.
- Hébergement dans l'Union européenne ; droits des personnes (accès, rectification, effacement) prévus dans la roadmap.

## 9. Réponse aux incidents (processus minimal)
1. Détecter (alerte ou signalement) → 2. Qualifier la gravité → 3. Contenir (révocation de jeton, retrait d'un déploiement) → 4. Corriger → 5. Documenter et tirer les leçons (retour dans le backlog).

## 10. Correspondance avec l'OWASP Top 10
| Risque | Mesure principale |
|---|---|
| A01 Contrôle d'accès défaillant | Rôles côté serveur, tests 401/403, accès par propriétaire |
| A02 Défaillances cryptographiques | TLS, chiffrement des secrets, aucun secret en clair |
| A03 Injection | Requêtes paramétrées, validation d'entrées |
| A04 Conception non sécurisée | Modélisation STRIDE dès l'étape Plan |
| A05 Mauvaise configuration | Durcissement des conteneurs, NetworkPolicies, en-têtes |
| A06 Composants vulnérables | SCA, Trivy, mises à jour automatisées |
| A07 Authentification défaillante | Keycloak, PKCE, blocage après échecs |
| A08 Intégrité logicielle | Pipeline contrôlé, tags immuables, SBOM |
| A09 Journalisation insuffisante | Logs structurés, alertes |
| A10 SSRF | Appels sortants limités, pas d'URL arbitraire fournie par l'utilisateur |
