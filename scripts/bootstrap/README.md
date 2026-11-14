# Configuration GitHub reproductible

| Fichier | Contenu |
|---|---|
| `github-bootstrap.sh` | Paramètres de sécurité, labels, jalons, issues, environnements, protections de branches, releases (API REST, idempotent) |
| `kanban.sh` | Kanban GitHub Projects : colonnes, champ Priorité, une carte par issue |
| `labels.tsv`, `milestones.tsv` | Labels et jalons |
| `issues/NNN.md` | Une issue par fichier (en-tête : titre, labels, jalon, état) |
| `releases/vX.Y.Z.md` | Notes de version |

```bash
gh auth login                          # compte propriétaire du dépôt
gh auth refresh -h github.com -s project
scripts/bootstrap/github-bootstrap.sh  # ou une étape : ... issues
scripts/bootstrap/kanban.sh
```

Les scripts sont relançables : un élément existant (même titre) est conservé, jamais dupliqué.
