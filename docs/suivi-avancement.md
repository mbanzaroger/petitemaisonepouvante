# Suivi d'avancement

Le suivi détaillé est tenu dans GitHub : [jalons](https://github.com/mbanzaroger/petitemaisonepouvante/milestones), [issues](https://github.com/mbanzaroger/petitemaisonepouvante/issues) et kanban (GitHub Projects). Ce tableau en donne la synthèse. Les numéros #9, #11 et #14 sont des pull requests Dependabot (mises à jour des images de `infra/`).

| Jalon | Version | État | Issues |
|---|---|---|---|
| J0 — Cadrage | v0.1.0 | ✅ Terminé | #1 à #3 |
| J1 — Processus qualité (phase 1) | v0.2.0 | ✅ Terminé | #4 à #8, #10, #12 |
| Industrialisation CI/CD et audit | v0.3.0 | ✅ Terminé | #13, #15, #16, #17 |
| J2 — Expérimentations (E1 à E4) | v0.4.0 | 🔲 À faire | #18 à #23 |
| J3 — Développement du POC | v0.5.0 | 🔲 À faire | #24 à #35 |
| J4 — Sécurité, charge, remédiation | v0.6.0 | 🔲 À faire | #36 à #39 |
| J5 — Soutenance | v1.0.0 | 🔲 À faire | #40, #41 |

## Jalon 1 — détail
| # | Issue | Document |
|---|---|---|
| 4 | Indicateurs qualité et dette technique | `04-indicateurs-qualite.md` |
| 5 | Schéma CI/CD détaillé | `02-cicd-pipeline.md` |
| 6 | Cycle DevSecOps complet | `05-cycle-devsecops.md` |
| 7 | Politique de tests | `06-politique-tests.md` |
| 8 | Politique de sécurité | `07-politique-securite.md` |
| 10 | Cartographie des compétences | `08-competences.md` |
| 12 | Action de formation | `09-formation.md` |

## Industrialisation (v0.3.0) — détail
| # | Issue | Livrable |
|---|---|---|
| 13 | Gouvernance du dépôt | `CONTRIBUTING.md`, `10-gouvernance-depot.md`, modèles d'issues et de PR |
| 15 | Pipelines GitHub Actions | `.github/workflows/`, `02-cicd-pipeline.md` |
| 16 | CI rouge (trivy-action supprimé) | Actions épinglées par SHA |
| 17 | Audit du projet | `audit/audit-2026-11-14.md` |
