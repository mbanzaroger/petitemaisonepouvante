#!/usr/bin/env bash
# DAST OWASP ZAP sur le staging (indicateur 4) : scan passif « baseline » de l'API puis du site, et scan actif de
# l'API à partir du contrat OpenAPI, authentifié avec un jeton client. Les alertes sont qualifiées dans
# .zap/rules.tsv (API) et .zap/rules-site.tsv (site) : IGNORE (faux positif justifié), WARN (suivi),
# FAIL (bloquant : injections, en-têtes de sécurité, CSP).
# Variables : BASE_URL, KEYCLOAK_URL, PME_CA_CERT, PME_ALICE_PASSWORD, SITE_URL (facultative).
set -uo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1
ZAP_IMAGE="${ZAP_IMAGE:-ghcr.io/zaproxy/zaproxy:stable}"
OUT="$PWD/zap"; mkdir -p "$OUT" && chmod 777 "$OUT"
cp .zap/rules.tsv .zap/rules-site.tsv docs/api/openapi.yaml "$OUT/"
SITE_URL="${SITE_URL:-https://app.pme.local:8443}"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"

token=$(curl -sS --cacert "$PME_CA_CERT" -X POST "$KEYCLOAK_URL/realms/pme/protocol/openid-connect/token" \
  -d grant_type=password -d client_id=pme-tests -d username=alice --data-urlencode password="$PME_ALICE_PASSWORD" \
  | jq -r '.access_token // empty')
if [ -n "${GITHUB_ACTIONS:-}" ] && [ -n "$token" ]; then echo "::add-mask::$token"; fi
[ -n "$token" ] || echo "::warning::Jeton client indisponible : le scan d'API ne couvrira que les routes publiques"

zap() { docker run --rm --network host -v "$OUT:/zap/wrk:rw" "$@"; }

# Le staging est joint par un « kubectl port-forward » (staging-bootstrap.sh) qui peut tomber sous la charge du
# scan actif (run du 16/11/2026 : site injoignable ensuite). Il est vérifié, et relancé si besoin, avant chaque scan.
acces_gateway() {
  curl -s --max-time 5 --cacert "$PME_CA_CERT" -o /dev/null "$BASE_URL/api/v1/categories" && return 0
  echo "::warning::Accès au Gateway perdu (port-forward) : relance"
  local svc
  svc=$(kubectl -n envoy-gateway-system get svc \
    -l gateway.envoyproxy.io/owning-gateway-name=pme-gateway,gateway.envoyproxy.io/owning-gateway-namespace=pme \
    -o jsonpath='{.items[0].metadata.name}')
  nohup kubectl -n envoy-gateway-system port-forward "svc/$svc" 8443:443 > /dev/null 2>&1 &
  for _ in $(seq 1 30); do
    curl -s --max-time 3 --cacert "$PME_CA_CERT" -o /dev/null "$BASE_URL/api/v1/categories" && return 0
    sleep 1
  done
  echo "::error::Gateway injoignable après relance du port-forward"; return 1
}

acces_gateway
echo "▸ Scan passif (baseline) du catalogue public"
zap "$ZAP_IMAGE" zap-baseline.py -t "$BASE_URL/api/v1/products" -c rules.tsv \
  -r zap-baseline.html -J zap-baseline.json -I
baseline=$?

acces_gateway
echo "▸ Scan passif (baseline) du site : SPA servie par nginx derrière le Gateway"
zap "$ZAP_IMAGE" zap-baseline.py -t "$SITE_URL/" -c rules-site.tsv \
  -r zap-site.html -J zap-site.json -I
site=$?

acces_gateway
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
  echo "Codes de sortie : baseline API $baseline, API $api, site $site (0 = aucune alerte de niveau FAIL)."
  echo
  echo "| Scan | Alerte | Risque | Occurrences |"
  echo "|---|---|---|---|"
  table "$OUT/zap-baseline.json" baseline
  table "$OUT/zap-api.json" API
  table "$OUT/zap-site.json" site
} | tee -a "$SUMMARY"
[ "$baseline" -eq 0 ] && [ "$api" -eq 0 ] && [ "$site" -eq 0 ]
