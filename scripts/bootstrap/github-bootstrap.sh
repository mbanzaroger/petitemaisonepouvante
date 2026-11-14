#!/usr/bin/env bash
# Configure le dépôt GitHub du projet (API REST uniquement, idempotent : relançable sans doublon).
#
# Usage : scripts/bootstrap/github-bootstrap.sh [étape ...]
# Étapes : settings labels milestones issues environments protection releases (défaut : toutes)
# Prérequis : gh authentifié avec les droits administrateur du dépôt, et les branches et tags déjà poussés.
#   REPO=propriétaire/dépôt pour cibler un autre dépôt (défaut : remote origin).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="${REPO:-$(git -C "$HERE" remote get-url origin | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

log()  { printf '\033[1;34m▸\033[0m %s\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*" >&2; }

api() { gh api -H "X-GitHub-Api-Version: 2022-11-28" "$@"; }

# Lit un champ d'en-tête (front matter) d'un fichier Markdown.
fm() { awk -v k="$2" 'NR==1 && /^---$/ {f=1; next} f && /^---$/ {exit} f && index($0, k": ")==1 {sub("^" k ": ", ""); print; exit}' "$1"; }
# Écrit le corps (après le front matter) dans un fichier.
body() { awk 'NR==1 && /^---$/ {f=1; next} f==1 && /^---$/ {f=2; next} f!=1 {print}' "$1" > "$2"; }

step_settings() {
  log "Paramètres du dépôt"
  api -X PATCH "repos/$REPO" -F delete_branch_on_merge=true -F allow_squash_merge=true \
    -F allow_merge_commit=true -F allow_rebase_merge=false -F has_projects=true -F has_issues=true \
    >/dev/null && ok "fusion : squash + merge commit, suppression des branches fusionnées" || warn "paramètres non modifiés"
  api -X PUT "repos/$REPO/vulnerability-alerts" >/dev/null 2>&1 && ok "alertes Dependabot" || warn "alertes Dependabot : droit manquant"
  api -X PUT "repos/$REPO/automated-security-fixes" >/dev/null 2>&1 && ok "correctifs de sécurité Dependabot" || warn "correctifs automatiques : droit manquant"
  api -X PUT "repos/$REPO/private-vulnerability-reporting" >/dev/null 2>&1 && ok "signalement privé des vulnérabilités" || warn "signalement privé : droit manquant"
  printf '{"security_and_analysis":{"secret_scanning":{"status":"enabled"},"secret_scanning_push_protection":{"status":"enabled"}}}' \
    | api -X PATCH "repos/$REPO" --input - >/dev/null 2>&1 && ok "secret scanning + push protection" || warn "secret scanning : droit manquant"
}

step_labels() {
  log "Labels"
  while IFS=$'\t' read -r name color desc; do
    [ -n "$name" ] || continue
    if api "repos/$REPO/labels" -f name="$name" -f color="$color" -f description="$desc" >/dev/null 2>&1; then
      ok "créé : $name"
    else
      enc=$(printf '%s' "$name" | sed 's/:/%3A/g')
      api -X PATCH "repos/$REPO/labels/$enc" -f color="$color" -f description="$desc" >/dev/null && ok "à jour : $name"
    fi
  done < "$HERE/labels.tsv"
}

milestone_number() {
  api --paginate "repos/$REPO/milestones?state=all&per_page=100" --jq '.[] | [.number, .title] | @tsv' \
    | awk -F'\t' -v t="$1" '$2==t {print $1; exit}'
}

step_milestones() {
  log "Jalons"
  while IFS=$'\t' read -r title _state desc; do
    [ -n "$title" ] || continue
    if [ -n "$(milestone_number "$title")" ]; then ok "existe : $title"; continue; fi
    api "repos/$REPO/milestones" -f title="$title" -f description="$desc" >/dev/null && ok "créé : $title"
  done < "$HERE/milestones.tsv"
}

close_milestones() {
  while IFS=$'\t' read -r title state _desc; do
    [ "$state" = "closed" ] || continue
    n=$(milestone_number "$title"); [ -n "$n" ] || continue
    api -X PATCH "repos/$REPO/milestones/$n" -f state=closed >/dev/null && ok "jalon fermé : $title"
  done < "$HERE/milestones.tsv"
}

step_issues() {
  log "Issues"
  api --paginate "repos/$REPO/issues?state=all&per_page=100" \
    --jq '.[] | select(.pull_request == null) | [.number, .state, .title] | @tsv' > "$TMP/existing.tsv"
  api --paginate "repos/$REPO/milestones?state=all&per_page=100" --jq '.[] | [.number, .title] | @tsv' > "$TMP/ms.tsv"
  for f in "$HERE"/issues/*.md; do
    title=$(fm "$f" title); labels=$(fm "$f" labels); ms=$(fm "$f" milestone); state=$(fm "$f" state)
    num=$(awk -F'\t' -v t="$title" '$3==t {print $1; exit}' "$TMP/existing.tsv")
    if [ -z "$num" ]; then
      body "$f" "$TMP/body.md"
      args=(-f "title=$title" -F "body=@$TMP/body.md")
      IFS=',' read -r -a labs <<< "$labels"
      for l in "${labs[@]}"; do args+=(-f "labels[]=$l"); done
      mnum=$(awk -F'\t' -v t="$ms" '$2==t {print $1; exit}' "$TMP/ms.tsv")
      [ -n "$mnum" ] && args+=(-F "milestone=$mnum")
      num=$(api "repos/$REPO/issues" "${args[@]}" --jq .number)
      ok "#$num créée : $title"
      sleep 1   # limite de création de contenu de l'API
    else
      ok "#$num existe : $title"
    fi
    if [ "$state" = "closed" ]; then
      api -X PATCH "repos/$REPO/issues/$num" -f state=closed -f state_reason=completed >/dev/null
    fi
  done
  close_milestones
}

step_environments() {
  log "Environnements de déploiement"
  owner_id=$(api "repos/$REPO" --jq .owner.id)
  if ! printf '{"wait_timer":0}' | api -X PUT "repos/$REPO/environments/staging" --input - >/dev/null; then
    warn "environnements : droit administration manquant"; return 0
  fi
  ok "staging"
  printf '{"wait_timer":0,"prevent_self_review":false,"reviewers":[{"type":"User","id":%s}],"deployment_branch_policy":{"protected_branches":false,"custom_branch_policies":true}}' "$owner_id" \
    | api -X PUT "repos/$REPO/environments/production" --input - >/dev/null && ok "production (approbation du propriétaire)"
  existing=$(api "repos/$REPO/environments/production/deployment-branch-policies" --jq '.branch_policies[].name' 2>/dev/null || true)
  grep -qx 'v\*' <<< "$existing" || api "repos/$REPO/environments/production/deployment-branch-policies" -f name='v*' -f type=tag >/dev/null || true
  grep -qx 'main' <<< "$existing" || api "repos/$REPO/environments/production/deployment-branch-policies" -f name=main -f type=branch >/dev/null || true
  ok "production limitée aux tags v* et à main"
}

step_protection() {
  log "Protection des branches"
  for b in main develop; do
    if ! api "repos/$REPO/branches/$b" >/dev/null 2>&1; then warn "branche $b absente"; continue; fi
    cat > "$TMP/protect.json" <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["Résultat CI"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "dismiss_stale_reviews": true, "require_code_owner_reviews": false, "required_approving_review_count": 0 },
  "restrictions": null,
  "required_conversation_resolution": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
JSON
    api -X PUT "repos/$REPO/branches/$b/protection" --input "$TMP/protect.json" >/dev/null \
      && ok "$b : PR obligatoire, check « Résultat CI », pas de force-push" || warn "$b : droit administration manquant"
  done
}

step_releases() {
  log "Releases"
  for f in "$HERE"/releases/v*.md; do
    tag=$(basename "$f" .md); name=$(fm "$f" name); target=$(fm "$f" target); pre=$(fm "$f" prerelease)
    if api "repos/$REPO/releases/tags/$tag" >/dev/null 2>&1; then ok "existe : $tag"; continue; fi
    body "$f" "$TMP/notes.md"
    api "repos/$REPO/releases" -f tag_name="$tag" -f target_commitish="$target" -f name="$name" \
      -F body=@"$TMP/notes.md" -F prerelease="${pre:-false}" >/dev/null && ok "publiée : $name" || warn "release $tag non créée"
  done
}

steps=("$@"); [ ${#steps[@]} -gt 0 ] || steps=(settings labels milestones issues environments protection releases)
log "Dépôt : $REPO"
for s in "${steps[@]}"; do "step_$s"; done
log "Terminé. Kanban (GitHub Projects) : scripts/bootstrap/kanban.sh"
