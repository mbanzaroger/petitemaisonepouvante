#!/usr/bin/env bash
# Expérimentation E3 (#20) : RabbitMQ sur Kubernetes (opérateur officiel, 3 nœuds, files quorum).
# Prérequis : cluster vide dans le contexte kubectl courant (kind, k3s, Minikube), helm, kubectl et jq.
# Usage : experiments/e3/run.sh   (résultats dans experiments/e3/resultats/)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
OPERATOR_VERSION="${OPERATOR_VERSION:-v2.23.3}"
CM_VERSION="${CM_VERSION:-v1.21.3}"
OUT="${OUT:-$PWD/resultats}"; mkdir -p "$OUT"; : > "$OUT/resultats.jsonl"
NS=pme-mq
log() { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }
t0=$(date +%s); elapsed() { echo $(( $(date +%s) - t0 )); }

log "0. cert-manager $CM_VERSION (prérequis des webhooks de l'opérateur depuis la v2.x)"
helm repo add jetstack https://charts.jetstack.io --force-update >/dev/null
helm upgrade --install cert-manager jetstack/cert-manager --version "$CM_VERSION" \
  -n cert-manager --create-namespace --set crds.enabled=true --wait --timeout 5m

log "1. Opérateur RabbitMQ $OPERATOR_VERSION"
kubectl apply -f "https://github.com/rabbitmq/cluster-operator/releases/download/$OPERATOR_VERSION/cluster-operator.yml"
kubectl -n rabbitmq-system rollout status deploy/rabbitmq-cluster-operator --timeout=180s

log "2. Cluster RabbitMQ à 3 nœuds"
# Le webhook de l'opérateur répond quelques secondes après son déploiement (certificat injecté par cert-manager).
for _ in $(seq 1 24); do kubectl apply -f 01-rabbitmq.yaml && break; sleep 5; done
kubectl -n "$NS" wait rabbitmqcluster/pme-rabbit --for=condition=AllReplicasReady --timeout=600s
echo "cluster_pret_s=$(elapsed)" >> "$OUT/durees.txt"
kubectl -n "$NS" exec pme-rabbit-server-0 -c rabbitmq -- rabbitmq-diagnostics -q server_version | tee "$OUT/version.txt"
kubectl -n "$NS" create configmap e3-script --from-file=e3.py --dry-run=client -o yaml | kubectl apply -f -

job() { # job <nom> <arguments du banc d'essai>
  local name=$1; shift
  kubectl -n "$NS" delete job "$name" --ignore-not-found >/dev/null
  cat <<YAML | kubectl apply -f - >/dev/null
apiVersion: batch/v1
kind: Job
metadata: { name: $name, namespace: $NS }
spec:
  backoffLimit: 0
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: banc
          image: python:3.12-slim
          command: ["sh", "-c", "pip install -q --no-cache-dir pika==1.3.2 && python -u /e3/e3.py $*"]
          env:
            - { name: RABBIT_HOST, value: pme-rabbit.$NS.svc }
            - name: RABBIT_USER
              valueFrom: { secretKeyRef: { name: pme-rabbit-default-user, key: username } }
            - name: RABBIT_PASSWORD
              valueFrom: { secretKeyRef: { name: pme-rabbit-default-user, key: password } }
          volumeMounts: [{ name: script, mountPath: /e3 }]
      volumes: [{ name: script, configMap: { name: e3-script } }]
YAML
}
wait_job() {
  local name=$1
  kubectl -n "$NS" wait "job/$name" --for=jsonpath='{.status.conditions[?(@.status=="True")].type}'=Complete --timeout=300s \
    || { kubectl -n "$NS" logs "job/$name" | tail -40; return 1; }
  kubectl -n "$NS" logs "job/$name" | grep '^RESULT ' | sed 's/^RESULT //' | tee -a "$OUT/resultats.jsonl"
}

log "3. Saga : doublons, crash d'un consommateur, message empoisonné"
job saga saga; wait_job saga

log "4. Durabilité : 2000 messages confirmés avant incident"
job publier-avant "publish 2000 avant"; wait_job publier-avant

log "5. Panne d'un nœud pendant la publication de 2000 messages"
job publier-pendant "publish 2000 pendant"
sleep 6
kubectl -n "$NS" delete pod pme-rabbit-server-1 --wait=false
wait_job publier-pendant
kubectl -n "$NS" wait rabbitmqcluster/pme-rabbit --for=condition=AllReplicasReady --timeout=600s

log "6. Redémarrage complet du cluster (les 3 nœuds)"
kubectl -n "$NS" delete pod -l app.kubernetes.io/name=pme-rabbit --wait=true
sleep 10
kubectl -n "$NS" wait rabbitmqcluster/pme-rabbit --for=condition=AllReplicasReady --timeout=600s
kubectl -n "$NS" exec pme-rabbit-server-0 -c rabbitmq -- rabbitmqctl -q list_queues name type messages | tee "$OUT/files.txt"

log "7. Lecture : aucun message confirmé ne doit manquer"
job lire "drain 4000"; wait_job lire
kubectl -n "$NS" exec pme-rabbit-server-0 -c rabbitmq -- rabbitmq-queues -q quorum_status stock.order-placed > "$OUT/quorum-status.txt" 2>&1 || true
echo "total_s=$(elapsed)" >> "$OUT/durees.txt"

saga=$(jq -c 'select(.mode=="saga")' "$OUT/resultats.jsonl")
drain=$(jq -c 'select(.mode=="drain")' "$OUT/resultats.jsonl")
pendant=$(jq -c 'select(.label=="pendant")' "$OUT/resultats.jsonl")
avant=$(jq -c 'select(.label=="avant")' "$OUT/resultats.jsonl")
ok=true
{
  echo "### Expérimentation E3 — résultats"
  echo "| Contrôle | Attendu | Obtenu | |"
  echo "|---|---|---|---|"
  row() { local r="✅"; [ "$3" = "$2" ] || { r="❌"; ok=false; }; echo "| $1 | $2 | $3 | $r |"; }
  row "événements uniques traités (200 + 20 doublons + 1 relivré)" 200 "$(jq .evenements_traites <<< "$saga")"
  row "stock final (1000 - 200)" 800 "$(jq .stock_final <<< "$saga")"
  row "message empoisonné en DLQ" 1 "$(jq .dlq <<< "$saga")"
  row "file principale vide" 0 "$(jq .file_restante <<< "$saga")"
  row "messages confirmés retrouvés après panne et redémarrage" 4000 "$(jq .uniques <<< "$drain")"
  echo ""
  echo "- Doublons ignorés par l'idempotence : $(jq .doublons_ignores <<< "$saga") ; messages relivrés après le crash : $(jq .relivres_apres_crash <<< "$saga")"
  echo "- Débit de publication confirmée : $(jq .debit_msg_s <<< "$avant") msg/s (nominal), $(jq .debit_msg_s <<< "$pendant") msg/s pendant la panne ($(jq .reconnexions <<< "$pendant") reconnexion(s))"
  echo "- Messages reçus en lecture : $(jq .recus <<< "$drain") pour $(jq .uniques <<< "$drain") uniques (au moins une fois)"
  echo ""
  echo '```'; cat "$OUT/version.txt" "$OUT/durees.txt"; echo '```'
} | tee "$OUT/resultats.md"
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then cat "$OUT/resultats.md" >> "$GITHUB_STEP_SUMMARY"; fi
$ok
