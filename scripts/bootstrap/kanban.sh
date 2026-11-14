#!/usr/bin/env bash
# Crée (ou met à jour) le kanban GitHub Projects du projet et y range toutes les issues du dépôt.
# Idempotent. À lancer depuis un poste où gh est connecté au compte propriétaire :
#   gh auth refresh -h github.com -s project
#   scripts/bootstrap/kanban.sh
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="${REPO:-$(git -C "$HERE" remote get-url origin | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')}"
OWNER="${REPO%%/*}"
TITLE="${TITLE:-petitemaisonepouvante — Kanban}"

log()  { printf '\033[1;34m▸\033[0m %s\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*" >&2; }

log "Projet « $TITLE » ($OWNER)"
num=$(gh project list --owner "$OWNER" --limit 100 --format json --jq ".projects[] | select(.title == \"$TITLE\") | .number")
if [ -z "$num" ]; then
  num=$(gh project create --owner "$OWNER" --title "$TITLE" --format json --jq .number)
  ok "créé (n° $num)"
else
  ok "existe (n° $num)"
fi
pid=$(gh project view "$num" --owner "$OWNER" --format json --jq .id)
gh project link "$num" --owner "$OWNER" --repo "$REPO" >/dev/null 2>&1 || true
gh project edit "$num" --owner "$OWNER" \
  --description "Suivi du bloc CESI « Superviser et assurer le développement des applications logicielles » — POC petitemaisonepouvante.com" \
  --readme "Colonnes : Backlog → À faire → En cours → En revue → Terminé. Une carte par issue ; la PR qui ferme l'issue la passe en Terminé. Jalons J0 à J5 = versions v0.1.0 à v1.0.0 (voir CONTRIBUTING.md)." >/dev/null
ok "lié au dépôt $REPO"

# Lecture JSON sans dépendre de jq : on passe par l'option --jq de gh.
status_id=$(gh project field-list "$num" --owner "$OWNER" --format json --jq '.fields[] | select(.name == "Status") | .id')

log "Colonnes du kanban"
if gh api graphql -f fieldId="$status_id" -f query='
mutation($fieldId: ID!) {
  updateProjectV2Field(input: {fieldId: $fieldId, singleSelectOptions: [
    {name: "Backlog",  color: GRAY,   description: "Identifié, pas encore prêt"},
    {name: "À faire",  color: BLUE,   description: "Prêt : critères définis"},
    {name: "En cours", color: YELLOW, description: "Branche créée, travail en cours"},
    {name: "En revue", color: PURPLE, description: "Pull request ouverte"},
    {name: "Terminé",  color: GREEN,  description: "PR fusionnée, issue fermée"}
  ]}) { projectV2Field { ... on ProjectV2SingleSelectField { id } } }
}' >/dev/null 2>&1; then
  ok "Backlog / À faire / En cours / En revue / Terminé"
  BACKLOG="Backlog"; TODO="À faire"; DONE="Terminé"
else
  warn "colonnes par défaut conservées (Todo / In Progress / Done)"
  BACKLOG="Todo"; TODO="Todo"; DONE="Done"
fi
option_id() {
  gh project field-list "$num" --owner "$OWNER" --format json \
    --jq ".fields[] | select(.name == \"$1\") | .options[] | select(.name == \"$2\") | .id"
}

if [ -z "$(gh project field-list "$num" --owner "$OWNER" --format json --jq '.fields[] | select(.name == "Priorité") | .id')" ]; then
  gh project field-create "$num" --owner "$OWNER" --name "Priorité" --data-type SINGLE_SELECT \
    --single-select-options "P1,P2,P3" >/dev/null && ok "champ Priorité"
fi
prio_id=$(gh project field-list "$num" --owner "$OWNER" --format json --jq '.fields[] | select(.name == "Priorité") | .id')

log "Cartes"
gh issue list --repo "$REPO" --state all --limit 300 --json number,url,state,milestone,labels \
  --jq '.[] | [.number, .url, .state, (.milestone.title // ""), ([.labels[].name] | join(","))] | @tsv' \
  | sort -n > "${TMPDIR:-/tmp}/pme-issues.tsv"
while IFS=$'\t' read -r n url state ms labels; do
  item=$(gh project item-add "$num" --owner "$OWNER" --url "$url" --format json --jq .id)
  if [ "$state" = "CLOSED" ]; then col="$DONE"
  elif [[ "$ms" == J2* ]]; then col="$TODO"
  else col="$BACKLOG"; fi
  gh project item-edit --id "$item" --project-id "$pid" --field-id "$status_id" \
    --single-select-option-id "$(option_id Status "$col")" >/dev/null
  p=$(grep -o 'prio:P[123]' <<< "$labels" | head -1 | cut -d: -f2 || true)
  if [ -n "$p" ]; then
    gh project item-edit --id "$item" --project-id "$pid" --field-id "$prio_id" \
      --single-select-option-id "$(option_id "Priorité" "$p")" >/dev/null
  fi
  ok "#$n → $col${p:+ ($p)}"
done < "${TMPDIR:-/tmp}/pme-issues.tsv"

url=$(gh project view "$num" --owner "$OWNER" --format json --jq .url)
log "Terminé : $url"
cat <<EOF
Deux réglages restent manuels (non exposés par l'API) :
  1. Vue tableau : « + New view » → Board, regroupée par Status.
  2. Workflows du projet (menu … → Workflows) : « Item closed » et « Pull request merged » → « $DONE »,
     « Item added to project » / « Auto-add » → dépôt $REPO, statut « $BACKLOG ».
EOF
