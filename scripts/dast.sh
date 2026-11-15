#!/usr/bin/env bash
# DAST OWASP ZAP sur le staging (indicateur 4) : scan passif « baseline » puis scan actif de l'API à partir du
# contrat OpenAPI, authentifié avec un jeton client. Les alertes sont qualifiées dans .zap/rules.tsv :
# IGNORE (faux positif justifié), WARN (suivi), FAIL (bloquant : injections, en-têtes de sécurité corrigés).
# Variables : BASE_URL, KEYCLOAK_URL, PME_CA_CERT, PME_ALICE_PASSWORD.
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1
ZAP_IMAGE="${ZAP_IMAGE:-ghcr.io/zaproxy/zaproxy:stable}"
OUT="$PWD/zap"; mkdir -p "$OUT" && chmod 777 "$OUT"
cp .zap/rules.tsv docs/api/openapi.yaml "$OUT/"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/stdout}"

token=$(curl -sS --cacert "$PME_CA_CERT" -X POST "$KEYCLOAK_URL/realms/pme/protocol/openid-connect/token" \
  -d grant_type=password -d client_id=pme-tests -d username=alice --data-urlencode password="$PME_ALICE_PASSWORD" \
  | jq -r '.access_token // empty')
if [ -n "${GITHUB_ACTIONS:-}" ] && [ -n "$token" ]; then echo "::add-mask::$token"; fi
[ -n "$token" ] || echo "::warning::Jeton client indisponible : le scan d'API ne couvrira que les routes publiques"

zap() { docker run --rm --network host -v "$OUT:/zap/wrk:rw" "$@"; }

echo "▸ Scan passif (baseline) du catalogue public"
zap "$ZAP_IMAGE" zap-baseline.py -t "$BASE_URL/api/v1/products" -c rules.tsv \
  -r zap-baseline.html -J zap-baseline.json -I
baseline=$?

echo "▸ Scan actif de l'API (contrat OpenAPI, jeton CUSTOMER)"
zap -e ZAP_AUTH_HEADER=Authorization -e ZAP_AUTH_HEADER_VALUE="Bearer $token" "$ZAP_IMAGE" \
  zap-api-scan.py -t openapi.yaml -f openapi -O "$BASE_URL" -c rules.tsv \
  -r zap-api.html -J zap-api.json -I
api=$?

table() { # table <rapport JSON> <libellé>
  [ -f "$1" ] || { echo "| $2 | rapport absent | | |"; return; }
  jq -r --arg scan "$2" '[.site[]?.alerts[]?] | sort_by(.riskcode | tonumber) | reverse | .[]
    | "| \($scan) | \(.alert) [\(.pluginid)] | \(.riskdesc | split(" ")[0]) | \(.count) |"' "$1"
}
{
  echo "## DAST OWASP ZAP"
  echo
  echo "Codes de sortie : baseline $baseline, API $api (0 = aucune alerte de niveau FAIL)."
  echo
  echo "| Scan | Alerte | Risque | Occurrences |"
  echo "|---|---|---|---|"
  table "$OUT/zap-baseline.json" baseline
  table "$OUT/zap-api.json" API
} >> "$SUMMARY"
[ "$baseline" -eq 0 ] && [ "$api" -eq 0 ]
