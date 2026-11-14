#!/usr/bin/env bash
# Tests de bout en bout sur l'environnement de staging, à travers le Gateway (TLS + JWT) :
# US1 à US4, saga complète order → stock → order, contrôle d'accès, corrélation, limitation de débit.
# Usage : scripts/smoke-test.sh https://api.pme.local:8443
# Variables : PME_CA_CERT, KEYCLOAK_URL, PME_ALICE_PASSWORD, PME_BOB_PASSWORD, PME_CAROL_PASSWORD, PME_ADMIN_PASSWORD
set -uo pipefail
BASE_URL="${1:-${BASE_URL:?BASE_URL requis}}"
KEYCLOAK_URL="${KEYCLOAK_URL:-https://keycloak.pme.local:8443}"
FIGURINE=0f6c1a10-0001-4000-8000-000000000001
BUSTE=0f6c1a10-0002-4000-8000-000000000002
RESULTS=$(mktemp); failures=0
api() { curl -sS --cacert "$PME_CA_CERT" --resolve api.pme.local:8443:127.0.0.1 --resolve keycloak.pme.local:8443:127.0.0.1 "$@"; }
check() { # check <libellé> <attendu> <obtenu>
  local mark="✅"; [ "$2" = "$3" ] || { mark="❌"; failures=$((failures + 1)); }
  printf '| %s | %s | %s | %s |\n' "$1" "$2" "$3" "$mark" | tee -a "$RESULTS"
}
code() { api -o /dev/null -w '%{http_code}' "$@"; }
token() {
  api -X POST "$KEYCLOAK_URL/realms/pme/protocol/openid-connect/token" -d grant_type=password -d client_id=pme-tests \
    -d username="$1" --data-urlencode password="$2" | jq -r '.access_token // empty'
}
await_status() { # await_status <jeton> <id> <statut>
  local s=""
  for _ in $(seq 1 30); do
    s=$(api -H "Authorization: Bearer $1" "$BASE_URL/api/v1/orders/$2" | jq -r '.status // empty')
    [ "$s" = "$3" ] && break; sleep 2
  done
  echo "$s"
}

echo "Attente des routes du Gateway…"
for _ in $(seq 1 60); do [ "$(code "$BASE_URL/api/v1/categories")" = "200" ] && break; sleep 3; done
alice=""; for _ in $(seq 1 30); do alice=$(token alice "$PME_ALICE_PASSWORD"); [ -n "$alice" ] && break; sleep 3; done
bob=$(token bob "$PME_BOB_PASSWORD"); carol=$(token carol "$PME_CAROL_PASSWORD"); admin=$(token admin-pme "$PME_ADMIN_PASSWORD")

echo "| Contrôle | Attendu | Obtenu | |" > "$RESULTS.md"; echo "|---|---|---|---|" >> "$RESULTS.md"
check "US1 — catalogue public (produits en vente)" 11 "$(api "$BASE_URL/api/v1/products?size=5" | jq -r .totalElements)"
check "US1 — produit inconnu" 404 "$(code "$BASE_URL/api/v1/products/7d1e1f00-0000-4000-8000-000000000999")"
check "US2 — commande sans jeton (Gateway)" 401 "$(code -X POST -H 'Content-Type: application/json' -d '{}' "$BASE_URL/api/v1/orders")"
check "US2 — jeton sans rôle CUSTOMER (Gateway)" 403 "$(code -X POST -H "Authorization: Bearer $bob" -H 'Content-Type: application/json' -d '{}' "$BASE_URL/api/v1/orders")"

order_ok=$(api -X POST -H "Authorization: Bearer $alice" -H 'Content-Type: application/json' -H 'X-Correlation-Id: smoke-saga-1' \
  -d "{\"lines\":[{\"productId\":\"$FIGURINE\",\"quantity\":1}]}" "$BASE_URL/api/v1/orders" | jq -r '.id // empty')
check "US3 — stock suffisant : PENDING → CONFIRMED" CONFIRMED "$(await_status "$alice" "$order_ok" CONFIRMED)"
order_ko=$(api -X POST -H "Authorization: Bearer $alice" -H 'Content-Type: application/json' \
  -d "{\"lines\":[{\"productId\":\"$BUSTE\",\"quantity\":3}]}" "$BASE_URL/api/v1/orders" | jq -r '.id // empty')
check "US3 — stock insuffisant : PENDING → CANCELLED" CANCELLED "$(await_status "$alice" "$order_ko" CANCELLED)"
check "US4 — historique d'alice" 2 "$(api -H "Authorization: Bearer $alice" "$BASE_URL/api/v1/orders" | jq -r .totalElements)"
check "US4 — commande d'alice vue par carol" 404 "$(code -H "Authorization: Bearer $carol" "$BASE_URL/api/v1/orders/$order_ok")"
check "Stock décrémenté (ADMIN)" 24 "$(api -H "Authorization: Bearer $admin" "$BASE_URL/api/v1/stock/$FIGURINE" | jq -r .available)"
check "Stock refusé à un client (Gateway)" 403 "$(code -H "Authorization: Bearer $alice" "$BASE_URL/api/v1/stock/$FIGURINE")"
corr=$(api -D - -o /dev/null -H 'X-Correlation-Id: smoke-corr-42' "$BASE_URL/api/v1/categories" | tr -d '\r' | awk -F': ' 'tolower($1)=="x-correlation-id"{print $2}')
check "Identifiant de corrélation renvoyé" smoke-corr-42 "$corr"
nosniff=$(api -D - -o /dev/null "$BASE_URL/api/v1/categories" | tr -d '\r' | awk -F': ' 'tolower($1)=="x-content-type-options"{print $2}')
check "En-tête X-Content-Type-Options" nosniff "$nosniff"
limited=$(seq 1 120 | xargs -P 30 -I{} curl -s -o /dev/null -w '%{http_code}\n' --cacert "$PME_CA_CERT" \
  --resolve api.pme.local:8443:127.0.0.1 -H "Authorization: Bearer $alice" "$BASE_URL/api/v1/orders" | grep -c '^429$')
check "Limitation de débit : $limited réponses 429 sur une rafale de 120" oui "$([ "$limited" -gt 0 ] && echo oui || echo non)"

cat "$RESULTS" >> "$RESULTS.md"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then { echo "### Tests de bout en bout (staging)"; cat "$RESULTS.md"; } >> "$GITHUB_STEP_SUMMARY"; fi
echo "Échecs : $failures"
exit "$failures"
