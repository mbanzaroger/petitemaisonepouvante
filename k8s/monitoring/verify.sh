#!/usr/bin/env bash
# Vérification de bout en bout de l'US5 sur le staging, après les smoke tests :
#  - métriques RED et métier collectées par Prometheus et lisibles dans Grafana (tableau de bord versionné) ;
#  - règles d'alerte chargées ;
#  - un même correlationId relie les logs de la commande dans order-service et stock-service.
# Variables : GRAFANA_PASSWORD (install.sh), CORRELATION_ID (défaut : smoke-saga-1, posé par scripts/smoke-test.sh).
set -uo pipefail
CORRELATION_ID="${CORRELATION_ID:-smoke-saga-1}"
RESULTS=$(mktemp); failures=0; pids=()
# Valeurs attendues tirées du dépôt (elles suivent l'ajout d'un service, d'une alerte ou d'un panneau) :
# une cible par microservice, plus RabbitMQ et le site.
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
SERVICES=$(find "$ROOT/services" -mindepth 1 -maxdepth 1 -type d | wc -l)
EXPECTED_TARGETS=$((SERVICES + 2))
EXPECTED_RULES=$(grep -c '^ *- alert:' "$ROOT/infra/monitoring/alerts.yml")
EXPECTED_PANELS=$(jq '.panels | length' "$ROOT/infra/monitoring/grafana/dashboards/pme-red.json")
trap 'kill "${pids[@]}" 2>/dev/null' EXIT
check() { # check <libellé> <attendu> <obtenu>
  local mark="✅"; [ "$2" = "$3" ] || { mark="❌"; failures=$((failures + 1)); }
  printf '| %s | %s | %s | %s |\n' "$1" "$2" "$3" "$mark" | tee -a "$RESULTS"
}
positive() { awk -v v="$1" 'BEGIN { print (v + 0 > 0) ? "oui" : "non" }'; }
promq() { curl -sS --get http://localhost:9090/api/v1/query --data-urlencode "query=$1" | jq -r '.data.result[0].value[1] // "0"'; }
grafana() { curl -sS -u "admin:$GRAFANA_PASSWORD" "$@"; }

kubectl -n monitoring port-forward svc/kps-kube-prometheus-stack-prometheus 9090:9090 >/dev/null 2>&1 & pids+=($!)
kubectl -n monitoring port-forward svc/kps-grafana 3000:80 >/dev/null 2>&1 & pids+=($!)

for _ in $(seq 1 30); do
  curl -sf http://localhost:9090/-/ready >/dev/null && curl -sf http://localhost:3000/api/health >/dev/null && break; sleep 2
done
echo "Attente de la découverte des cibles ($SERVICES services, RabbitMQ, site)…"
targets=0
for _ in $(seq 1 40); do
  targets=$(promq 'count(up{namespace="pme"} == 1)'); [ "$targets" -ge "$EXPECTED_TARGETS" ] 2>/dev/null && break; sleep 5
done
echo "Attente des règles et du tableau de bord…"
for _ in $(seq 1 24); do
  rules=$(curl -sS http://localhost:9090/api/v1/rules | jq '[.data.groups[] | select(.name | startswith("pme-")) | .rules[]] | length')
  panels=$(grafana http://localhost:3000/api/dashboards/uid/pme-red | jq '.dashboard.panels // [] | length')
  [ "${rules:-0}" -ge "$EXPECTED_RULES" ] && [ "${panels:-0}" -gt 0 ] && break; sleep 5
done

echo "| Contrôle | Attendu | Obtenu | |" > "$RESULTS.md"; echo "|---|---|---|---|" >> "$RESULTS.md"
check "Cibles collectées et actives ($SERVICES services, RabbitMQ, site)" "$EXPECTED_TARGETS" "$targets"
check "RED : requêtes HTTP mesurées hors /actuator" oui "$(positive "$(promq 'sum(http_server_requests_seconds_count{namespace="pme",uri!~"/actuator.*"})')")"
check "Saga : commandes créées comptées" oui "$(positive "$(promq 'sum(pme_orders_total{event="placed"})')")"
check "Saga : commandes confirmées comptées" oui "$(positive "$(promq 'sum(pme_orders_total{event="confirmed"})')")"
check "Saga : commandes annulées comptées" oui "$(positive "$(promq 'sum(pme_orders_total{event="cancelled"})')")"
check "Saga : réservations de stock comptées" oui "$(positive "$(promq 'sum(pme_stock_reservations_total{outcome="reserved"})')")"
check "Saga : durées mesurées (histogramme)" oui "$(positive "$(promq 'sum(pme_saga_duration_seconds_count)')")"
check "Boîte d'envoi vide (aucun événement bloqué)" 0 "$(promq 'sum(pme_outbox_pending)')"
check "Files de rebut supervisées" 2 "$(promq 'count(rabbitmq_detailed_queue_messages_ready{queue=~".+[.]dlq"})')"
check "Règles d'alerte chargées" "$EXPECTED_RULES" "$rules"
check "Tableau de bord Grafana pme-red (panneaux)" "$EXPECTED_PANELS" "$panels"
grafana -H 'Content-Type: application/json' http://localhost:3000/api/ds/query -d \
  '{"from":"now-15m","to":"now","queries":[{"refId":"A","datasource":{"uid":"prometheus"},"expr":"sum(pme_orders_total)","instant":true}]}' \
  > "$RESULTS.grafana"
via_grafana=$(jq -r '.results.A.frames[0].data.values[1][0] // 0' "$RESULTS.grafana" 2>/dev/null || echo 0)
[ "$(positive "$via_grafana")" = oui ] || { echo "Réponse Grafana :"; head -c 600 "$RESULTS.grafana"; echo; }
check "Métriques lisibles dans Grafana (source « prometheus »)" oui "$(positive "$via_grafana")"

kubectl -n pme logs deploy/order-service --tail=-1 | grep -F "$CORRELATION_ID" > "$RESULTS.order"
kubectl -n pme logs deploy/stock-service --tail=-1 | grep -F "$CORRELATION_ID" > "$RESULTS.stock"
check "Corrélation $CORRELATION_ID : logs order-service (création, publication, résultat)" oui \
  "$([ "$(wc -l < "$RESULTS.order")" -ge 3 ] && echo oui || echo non)"
check "Corrélation $CORRELATION_ID : logs stock-service (réservation, publication)" oui \
  "$([ "$(wc -l < "$RESULTS.stock")" -ge 2 ] && echo oui || echo non)"

# Site : métriques nginx, journaux JSON et appels du navigateur corrélés jusqu'aux services (tests e2e du CD)
check "Site : requêtes servies mesurées (exporteur nginx)" oui \
  "$(positive "$(promq 'sum(nginx_http_requests_total{service="web-frontend"})')")"
kubectl -n pme logs deploy/web-frontend -c web-frontend --tail=200 \
  | jq -cR 'fromjson? | select(.service == "web-frontend")' > "$RESULTS.web" || true
check "Site : journaux d'accès au format JSON" oui "$([ -s "$RESULTS.web" ] && echo oui || echo non)"
check "Site : appels du navigateur (web-…) corrélés dans les logs order-service" oui \
  "$(kubectl -n pme logs deploy/order-service --tail=-1 | grep -q 'web-' && echo oui || echo non)"

cat "$RESULTS" >> "$RESULTS.md"
{
  echo "## Supervision (US5)"; echo; cat "$RESULTS.md"; echo
  echo "Échecs : $failures"; echo
  echo "### Logs reliés par le correlationId \`$CORRELATION_ID\`"; echo
  echo '```text'; cut -c1-220 "$RESULTS.order" "$RESULTS.stock"; echo '```'
} | tee -a "${GITHUB_STEP_SUMMARY:-/dev/null}"
echo "Échecs : $failures"
[ "$failures" -eq 0 ]
