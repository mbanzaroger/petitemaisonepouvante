#!/usr/bin/env bash
# Test de charge JMeter contre le staging Kubernetes, en deux paliers :
#  1. « nominal » : charge réaliste, seuils de l'indicateur 3 bloquants (p95 < 300 ms, erreurs < 1 %) ;
#  2. « stress »  : visiteurs du catalogue sans temps de réflexion, pour observer la mise à l'échelle (HPA)
#     et le comportement en saturation (non bloquant, mesuré et commenté dans l'analyse de sécurité).
# Appelé par .github/workflows/cd.yml quand l'entrée « charge » est cochée, après le déploiement et la supervision.
# Variables : PME_ALICE_PASSWORD, PME_CAROL_PASSWORD. Options : NOMINAL_DURATION, STRESS_DURATION, STRESS_THREADS.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
JMETER_VERSION=5.6.3
P95_MAX_MS="${P95_MAX_MS:-300}"
ERROR_MAX_PCT="${ERROR_MAX_PCT:-1}"
OUT="$PWD/target"; rm -rf "$OUT"; mkdir -p "$OUT"
WORK="${RUNNER_TEMP:-/tmp}/pme-charge"; mkdir -p "$WORK"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"
pids=()
cleanup() {
  kill "${pids[@]}" 2>/dev/null || true
  if [ -f "$WORK/hosts.bak" ]; then sudo cp "$WORK/hosts.bak" /etc/hosts; fi
  rm -f "$WORK/secrets.properties"
}
trap cleanup EXIT

echo "▸ JMeter $JMETER_VERSION (archive Apache, empreinte SHA-512 vérifiée)"
base="https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-$JMETER_VERSION.tgz"
if [ ! -x "$WORK/apache-jmeter-$JMETER_VERSION/bin/jmeter" ]; then
  curl -fsSL -o "$WORK/jmeter.tgz" "$base"
  curl -fsSL -o "$WORK/jmeter.tgz.sha512" "$base.sha512"
  expected=$(grep -oE '[0-9a-fA-F]{128}' "$WORK/jmeter.tgz.sha512" | head -1)
  echo "${expected,,}  $WORK/jmeter.tgz" | sha512sum -c -
  tar xzf "$WORK/jmeter.tgz" -C "$WORK"
fi
JMETER="$WORK/apache-jmeter-$JMETER_VERSION/bin/jmeter"

echo "▸ Accès direct au Gateway par son NodePort (un port-forward kubectl fausserait les latences)"
node_ip=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
node_port=$(kubectl -n envoy-gateway-system get svc \
  -l gateway.envoyproxy.io/owning-gateway-name=pme-gateway,gateway.envoyproxy.io/owning-gateway-namespace=pme \
  -o jsonpath='{.items[0].spec.ports[?(@.port==443)].nodePort}')
sudo cp /etc/hosts "$WORK/hosts.bak"
sed '/pme\.local/d' "$WORK/hosts.bak" > "$WORK/hosts"
echo "$node_ip api.pme.local keycloak.pme.local" >> "$WORK/hosts"
sudo cp "$WORK/hosts" /etc/hosts
echo "Gateway : https://api.pme.local:$node_port ($node_ip)"

# Mots de passe des comptes de test passés par un fichier de propriétés (jamais sur la ligne de commande)
umask 077
printf 'alice_password=%s\ncarol_password=%s\n' "$PME_ALICE_PASSWORD" "$PME_CAROL_PASSWORD" > "$WORK/secrets.properties"

kubectl -n monitoring port-forward svc/kps-kube-prometheus-stack-prometheus 9090:9090 >/dev/null 2>&1 & pids+=($!)
promq() { # promq <requête> <instant> <filtre jq>
  curl -sS --get http://localhost:9090/api/v1/query --data-urlencode "query=$1" --data-urlencode "time=$2" | jq -r "$3"
}
fmt() { awk -v v="$1" 'BEGIN { if (v ~ /^[0-9.eE+-]+$/) printf "%.0f", v; else print v }'; }

run_profile() { # run_profile <nom> <visiteurs> <réflexion min ms> <réflexion amplitude ms> <durée s> <montée s>
  local name=$1 dir="$OUT/$1" start end window
  mkdir -p "$dir"
  echo "▸ Palier « $name » : $2 visiteurs du catalogue, 10 clients authentifiés, $5 s après $6 s de montée"
  kubectl -n pme get hpa 2>/dev/null > "$dir/hpa-avant.txt" || true
  start=$(date +%s)
  "$JMETER" -n -t pme-charge.jmx -q "$WORK/secrets.properties" \
    -Japi_port="$node_port" -Jcatalog_threads="$2" -Jorder_threads=10 \
    -Jthink_min="$3" -Jthink_range="$4" -Jduration="$5" -Jrampup="$6" \
    -Jjmeter.reportgenerator.sample_filter='^API .*' \
    -l "$dir/resultats.jtl" -j "$dir/jmeter.log" -e -o "$dir/rapport"
  end=$(date +%s); window="$(( end - start ))s"
  kubectl -n pme get hpa 2>/dev/null | tee "$dir/hpa-apres.txt" || true

  local stats="$dir/rapport/statistics.json"
  P95=$(jq '.Total.pct2ResTime' "$stats"); ERRORS=$(jq '.Total.errorPct' "$stats")
  SAMPLES=$(jq '.Total.sampleCount' "$stats"); THROUGHPUT=$(jq '.Total.throughput' "$stats")
  SERVER_P95=$(promq "1000 * histogram_quantile(0.95, sum by (le) (increase(http_server_requests_seconds_bucket{namespace=\"pme\",uri!~\"/actuator.*\"}[$window])))" "$end" '.data.result[0].value[1] // "n/d"')
  SAGA_P95=$(promq "1000 * histogram_quantile(0.95, sum by (le) (increase(pme_saga_duration_seconds_bucket[$window])))" "$end" '.data.result[0].value[1] // "n/d"')
  REPLICAS=$(promq "max_over_time(count by (service) (up{namespace=\"pme\",service=~\".+-service\"} == 1)[$window:15s])" "$end" \
    '[.data.result[] | "\(.metric.service) \(.value[1])"] | join(", ")')
  CPU=$(promq "max_over_time(max by (service) (process_cpu_usage{namespace=\"pme\",service=~\".+-service\"})[$window:15s])" "$end" \
    '[.data.result[] | "\(.metric.service) \((.value[1] | tonumber) * 100 | floor) %"] | join(", ")')
  {
    echo "### Palier « $name »"
    echo
    echo "$2 visiteurs (réflexion $3 à $(( $3 + $4 )) ms) + 10 clients authentifiés · $5 s après $6 s de montée · $SAMPLES requêtes API · $(fmt "$THROUGHPUT") req/s"
    echo
    echo "| Mesure | Valeur |"
    echo "|---|---|"
    echo "| Latence p95 côté client (JMeter) | $(fmt "$P95") ms |"
    echo "| Taux d'erreur | $ERRORS % |"
    echo "| Latence p95 côté serveur (Prometheus, hors /actuator) | $(fmt "$SERVER_P95") ms |"
    echo "| Durée de saga p95 (création → état final) | $(fmt "$SAGA_P95") ms |"
    echo "| Instances maximales par service (HPA) | ${REPLICAS:-n/d} |"
    echo "| CPU maximal par instance (part d'un cœur) | ${CPU:-n/d} |"
    echo
    echo "| Requête | Nombre | Erreurs (%) | Moyenne (ms) | p95 (ms) | Débit (req/s) |"
    echo "|---|---|---|---|---|---|"
    jq -r 'to_entries[] | select(.key != "Total") | .value
      | "| \(.transaction) | \(.sampleCount) | \(.errorPct) | \(.meanResTime | floor) | \(.pct2ResTime | floor) | \(.throughput * 100 | floor / 100) |"' "$stats"
    echo
  } > "$dir/synthese.md"
}

run_profile nominal 40 300 700 "${NOMINAL_DURATION:-180}" 30
nominal_p95=$P95; nominal_errors=$ERRORS
ok_p95=$(awk -v v="$nominal_p95" -v m="$P95_MAX_MS" 'BEGIN { print (v < m) ? "✅" : "❌" }')
ok_err=$(awk -v v="$nominal_errors" -v m="$ERROR_MAX_PCT" 'BEGIN { print (v < m) ? "✅" : "❌" }')

run_profile stress "${STRESS_THREADS:-150}" 0 50 "${STRESS_DURATION:-240}" 60
echo "▸ Instances une minute après le palier de stress"
sleep 60; kubectl -n pme get hpa,pods -l 'app in (catalog-service,order-service,stock-service)' 2>/dev/null \
  | tee "$OUT/stress/apres-1-min.txt" || true

{
  echo "## Test de charge JMeter (indicateur 3)"
  echo
  echo "| Indicateur (palier nominal) | Seuil | Mesuré | |"
  echo "|---|---|---|---|"
  echo "| Latence p95 | < $P95_MAX_MS ms | $(fmt "$nominal_p95") ms | $ok_p95 |"
  echo "| Taux d'erreur | < $ERROR_MAX_PCT % | $nominal_errors % | $ok_err |"
  echo
  cat "$OUT/nominal/synthese.md" "$OUT/stress/synthese.md"
} | tee "$OUT/synthese.md" >> "$SUMMARY"
cat "$OUT/synthese.md"

[ "$ok_p95" = "✅" ] && [ "$ok_err" = "✅" ]
