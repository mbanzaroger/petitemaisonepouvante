#!/usr/bin/env bash
# Expérimentation E4 (#21) : observabilité d'un microservice Spring Boot sur Kubernetes.
# kube-prometheus-stack (Prometheus Operator, Alertmanager, Grafana), ServiceMonitor, règles RED, panne de base simulée.
# Prérequis : cluster vide dans le contexte kubectl courant et image « catalog-service:e4 » chargée dans le cluster
#   (kind : docker build -t catalog-service:e4 services/catalog-service && kind load docker-image catalog-service:e4)
# Usage : experiments/e4/run.sh   (résultats dans experiments/e4/resultats/)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
KPS_VERSION="${KPS_VERSION:-93.3.0}"
OUT="${OUT:-$PWD/resultats}"; mkdir -p "$OUT"
log() { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }
t0=$(date +%s); elapsed() { echo $(( $(date +%s) - t0 )); }
pids=()
cleanup() { for p in "${pids[@]}"; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT

log "1. kube-prometheus-stack $KPS_VERSION"
grafana_pw=$(openssl rand -hex 16)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts --force-update >/dev/null
helm upgrade --install kps prometheus-community/kube-prometheus-stack --version "$KPS_VERSION" \
  -n monitoring --create-namespace -f values-kps.yaml --set grafana.adminPassword="$grafana_pw" --wait --timeout 8m
echo "supervision_prete_s=$(elapsed)" >> "$OUT/durees.txt"

log "2. catalog-service et PostgreSQL"
kubectl create namespace pme --dry-run=client -o yaml | kubectl apply -f -
kubectl -n pme create secret generic catalog-db --from-literal=password="$(openssl rand -hex 16)" \
  --dry-run=client -o yaml | kubectl apply -f -
kubectl apply -f 01-catalog.yaml
kubectl -n pme rollout status deploy/catalog-db --timeout=180s
kubectl -n pme rollout status deploy/catalog-service --timeout=300s
echo "service_pret_s=$(elapsed)" >> "$OUT/durees.txt"

log "3. ServiceMonitor, règles d'alerte et tableau de bord RED"
kubectl apply -f 02-monitoring.yaml
kubectl -n monitoring create configmap dashboard-red --from-file=dashboard-red.json \
  --dry-run=client -o yaml | kubectl label --local -f - grafana_dashboard=1 -o yaml | kubectl apply -f -

log "4. Accès local (redirections de port)"
kubectl -n pme port-forward svc/catalog-service 8081:8081 >/dev/null 2>&1 & pids+=($!)
kubectl -n monitoring port-forward svc/kps-kube-prometheus-stack-prometheus 9090:9090 >/dev/null 2>&1 & pids+=($!)
kubectl -n monitoring port-forward svc/kps-kube-prometheus-stack-alertmanager 9093:9093 >/dev/null 2>&1 & pids+=($!)
kubectl -n monitoring port-forward svc/kps-grafana 3000:80 >/dev/null 2>&1 & pids+=($!)
sleep 5
promq() { curl -sS --get http://localhost:9090/api/v1/query --data-urlencode "query=$1" | jq -r '.data.result[0].value[1] // "absent"'; }

log "5. Charge continue sur le service (identifiants de corrélation e4-<n>)"
( i=0; while true; do i=$((i+1)); curl -s -o /dev/null -H "X-Correlation-Id: e4-$i" http://localhost:8081/actuator/health; done ) & pids+=($!)

log "6. La cible est-elle collectée ?"
up="absent"
for _ in $(seq 1 30); do up=$(promq 'up{service="catalog-service"}'); [ "$up" = "1" ] && break; sleep 5; done
echo "cible_collectee_s=$(elapsed)" >> "$OUT/durees.txt"
sleep 40
debit=$(promq 'sum(rate(http_server_requests_seconds_count{service="catalog-service"}[1m]))')
p95=$(promq '1000 * histogram_quantile(0.95, sum by (le) (rate(http_server_requests_seconds_bucket{service="catalog-service"}[1m])))')
erreurs_avant=$(promq 'sum(rate(http_server_requests_seconds_count{service="catalog-service",status=~"5.."}[1m])) or vector(0)')

log "7. Panne simulée de la base : la santé passe en 503, l'alerte doit se déclencher"
kubectl -n pme scale deploy/catalog-db --replicas=0
t_panne=$(date +%s)
alerte="non"
for _ in $(seq 1 36); do
  if [ "$(promq 'ALERTS{alertname="TauxErreurEleve",alertstate="firing"}')" = "1" ]; then alerte="oui"; break; fi
  sleep 5
done
delai_alerte=$(( $(date +%s) - t_panne ))
taux_erreur=$(promq '100 * sum(rate(http_server_requests_seconds_count{service="catalog-service",status=~"5.."}[1m])) / sum(rate(http_server_requests_seconds_count{service="catalog-service"}[1m]))')
alertmanager=$(curl -sS http://localhost:9093/api/v2/alerts | jq '[.[] | select(.labels.alertname=="TauxErreurEleve")] | length')

log "8. Retour à la normale : l'alerte doit se résoudre"
kubectl -n pme scale deploy/catalog-db --replicas=1
kubectl -n pme rollout status deploy/catalog-db --timeout=180s
t_retour=$(date +%s)
resolue="non"
for _ in $(seq 1 36); do
  if [ "$(promq 'ALERTS{alertname="TauxErreurEleve",alertstate="firing"}')" = "absent" ]; then resolue="oui"; break; fi
  sleep 5
done
delai_resolution=$(( $(date +%s) - t_retour ))

log "9. Tableau de bord Grafana et corrélation des logs"
dashboard=$(curl -sS -u "admin:$grafana_pw" "http://localhost:3000/api/dashboards/uid/pme-red" | jq -r '.dashboard.title // "absent"')
curl -s -o /dev/null -H "X-Correlation-Id: e4-verification" http://localhost:8081/actuator/health
sleep 2
kubectl -n pme logs deploy/catalog-service > "$OUT/logs-catalog.txt"
lignes_e4_42=$(grep -c "catalog-service,e4-verification\]" "$OUT/logs-catalog.txt" || true)
grep -m3 "catalog-service,e4-verification\]" "$OUT/logs-catalog.txt" > "$OUT/extrait-logs.txt" || true
cat "$OUT/extrait-logs.txt"
echo "total_s=$(elapsed)" >> "$OUT/durees.txt"

ok=true
{
  echo "### Expérimentation E4 — résultats"
  echo "| Contrôle | Attendu | Obtenu | |"
  echo "|---|---|---|---|"
  row() { local r="✅"; [ "$3" = "$2" ] || { r="❌"; ok=false; }; echo "| $1 | $2 | $3 | $r |"; }
  row "cible catalog-service collectée (up)" 1 "$up"
  row "alerte TauxErreurEleve déclenchée pendant la panne" oui "$alerte"
  row "alerte reçue par Alertmanager" 1 "$alertmanager"
  row "alerte résolue après le retour de la base" oui "$resolue"
  row "tableau de bord RED provisionné dans Grafana" "PME — RED des microservices" "$dashboard"
  r="✅"; [ "${lignes_e4_42:-0}" -ge 1 ] || { r="❌"; ok=false; }; echo "| lignes de log portant le correlationId e4-verification | ≥ 1 | ${lignes_e4_42:-0} | $r |"
  echo ""
  echo "- Débit nominal : ${debit} req/s ; p95 nominal : ${p95} ms ; erreurs 5xx avant la panne : ${erreurs_avant} req/s"
  echo "- Taux d'erreurs pendant la panne : ${taux_erreur} % ; alerte déclenchée en ${delai_alerte} s (fenêtre 1 min + for 30 s) ; résolue en ${delai_resolution} s"
  echo ""
  echo '```'; cat "$OUT/durees.txt"; echo '```'
} | tee "$OUT/resultats.md"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then cat "$OUT/resultats.md" >> "$GITHUB_STEP_SUMMARY"; fi
$ok
