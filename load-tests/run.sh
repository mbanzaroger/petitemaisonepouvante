#!/usr/bin/env bash
# Test de charge JMeter contre le staging Kubernetes (indicateur 3 : p95 < 300 ms, erreurs < 1 %).
# Appelé par .github/workflows/cd.yml quand l'entrée « charge » est cochée, après le déploiement et la supervision.
# Variables : PME_ALICE_PASSWORD, PME_CAROL_PASSWORD ; options : DURATION (s), CATALOG_THREADS, ORDER_THREADS.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
JMETER_VERSION=5.6.3
P95_MAX_MS="${P95_MAX_MS:-300}"
ERROR_MAX_PCT="${ERROR_MAX_PCT:-1}"
OUT="$PWD/target"; rm -rf "$OUT"; mkdir -p "$OUT"
WORK="${RUNNER_TEMP:-/tmp}/pme-charge"; mkdir -p "$WORK"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/stdout}"
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

echo "▸ Instances avant la charge"
kubectl -n pme get hpa 2>/dev/null | tee "$OUT/hpa-avant.txt" || true
start=$(date +%s)
"$JMETER" -n -t pme-charge.jmx -q "$WORK/secrets.properties" \
  -Japi_port="$node_port" -Jduration="${DURATION:-180}" -Jrampup="${RAMPUP:-30}" \
  -Jcatalog_threads="${CATALOG_THREADS:-40}" -Jorder_threads="${ORDER_THREADS:-10}" \
  -Jjmeter.reportgenerator.sample_filter='^API .*' \
  -l "$OUT/resultats.jtl" -j "$OUT/jmeter.log" -e -o "$OUT/rapport"
end=$(date +%s)
echo "▸ Instances après la charge"
kubectl -n pme get hpa 2>/dev/null | tee "$OUT/hpa-apres.txt" || true

echo "▸ Mesures côté serveur (Prometheus) sur la fenêtre du test"
kubectl -n monitoring port-forward svc/kps-kube-prometheus-stack-prometheus 9090:9090 >/dev/null 2>&1 & pids+=($!)
sleep 5
window="$(( end - start ))s"
promq() { curl -sS --get http://localhost:9090/api/v1/query --data-urlencode "query=$1" --data-urlencode "time=$end" | jq -r "$2"; }
server_p95=$(promq "1000 * histogram_quantile(0.95, sum by (le) (increase(http_server_requests_seconds_bucket{namespace=\"pme\",uri!~\"/actuator.*\"}[$window])))" '.data.result[0].value[1] // "n/d"')
replicas=$(promq "max_over_time(count by (service) (up{namespace=\"pme\",service=~\".+-service\"} == 1)[$window:15s])" \
  '[.data.result[] | "\(.metric.service) : \(.value[1])"] | join(", ")')
saga_p95=$(promq "1000 * histogram_quantile(0.95, sum by (le) (increase(pme_saga_duration_seconds_bucket[$window])))" '.data.result[0].value[1] // "n/d"')

stats="$OUT/rapport/statistics.json"
p95=$(jq '.Total.pct2ResTime' "$stats")
errors=$(jq '.Total.errorPct' "$stats")
samples=$(jq '.Total.sampleCount' "$stats")
throughput=$(jq '.Total.throughput' "$stats")
ok_p95=$(awk -v v="$p95" -v m="$P95_MAX_MS" 'BEGIN { print (v < m) ? "✅" : "❌" }')
ok_err=$(awk -v v="$errors" -v m="$ERROR_MAX_PCT" 'BEGIN { print (v < m) ? "✅" : "❌" }')
fmt() { awk -v v="$1" 'BEGIN { if (v ~ /^[0-9.eE+-]+$/) printf "%.0f", v; else print v }'; }

{
  echo "## Test de charge JMeter (indicateur 3)"
  echo
  echo "Durée : ${DURATION:-180} s après ${RAMPUP:-30} s de montée en charge · ${CATALOG_THREADS:-40} visiteurs + ${ORDER_THREADS:-10} clients authentifiés · $samples requêtes API · $(fmt "$throughput") req/s"
  echo
  echo "| Indicateur | Seuil | Mesuré (client JMeter) | |"
  echo "|---|---|---|---|"
  echo "| Latence p95 | < $P95_MAX_MS ms | $(fmt "$p95") ms | $ok_p95 |"
  echo "| Taux d'erreur | < $ERROR_MAX_PCT % | $errors % | $ok_err |"
  echo
  echo "| Mesure côté serveur (Prometheus) | Valeur |"
  echo "|---|---|"
  echo "| Latence p95 des services (hors /actuator) | $(fmt "$server_p95") ms |"
  echo "| Durée de saga p95 (création → état final) | $(fmt "$saga_p95") ms |"
  echo "| Instances maximales par service (HPA) | ${replicas:-n/d} |"
  echo
  echo "| Requête | Nombre | Erreurs (%) | Moyenne (ms) | p95 (ms) | Débit (req/s) |"
  echo "|---|---|---|---|---|---|"
  jq -r 'to_entries[] | select(.key != "Total") | .value
    | "| \(.transaction) | \(.sampleCount) | \(.errorPct) | \(.meanResTime | floor) | \(.pct2ResTime | floor) | \(.throughput * 100 | floor / 100) |"' "$stats"
} | tee -a "$SUMMARY" > "$OUT/synthese.md"

[ "$ok_p95" = "✅" ] && [ "$ok_err" = "✅" ]
