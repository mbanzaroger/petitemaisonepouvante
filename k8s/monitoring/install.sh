#!/usr/bin/env bash
# Supervision du staging (US5) : kube-prometheus-stack, collecte des services et de RabbitMQ, règles d'alerte
# et tableau de bord. Règles et tableau de bord sont lus dans infra/monitoring : une seule source pour le poste
# local (docker compose) et Kubernetes. Appelé par .github/workflows/cd.yml après le déploiement.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
KPS_VERSION="${KPS_VERSION:-93.3.0}"
MONITORING=../../infra/monitoring
ENV_FILE="${GITHUB_ENV:-${RUNNER_TEMP:-/tmp}/pme-monitoring.env}"
log() { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }
mask() { if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::add-mask::$1"; fi; }

log "Secret administrateur Grafana (généré à l'exécution)"
kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -
grafana_pw=$(openssl rand -hex 16); mask "$grafana_pw"
kubectl -n monitoring create secret generic grafana-admin --from-literal=admin-user=admin \
  --from-literal=admin-password="$grafana_pw" --dry-run=client -o yaml | kubectl apply -f -

log "kube-prometheus-stack $KPS_VERSION"
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts --force-update >/dev/null
helm upgrade --install kps prometheus-community/kube-prometheus-stack --version "$KPS_VERSION" \
  -n monitoring -f values-kps.yaml --wait --timeout 10m

log "Collecte : services et RabbitMQ"
kubectl apply -f servicemonitors.yaml

log "Règles d'alerte (infra/monitoring/alerts.yml → PrometheusRule)"
{
  printf 'apiVersion: monitoring.coreos.com/v1\nkind: PrometheusRule\nmetadata:\n  name: pme-alertes\n  namespace: pme\nspec:\n'
  sed -e '/^#/d' -e 's/^/  /' "$MONITORING/alerts.yml"
} | kubectl apply -f -

log "Tableaux de bord Grafana (infra/monitoring/grafana/dashboards)"
kubectl -n monitoring create configmap pme-dashboards --from-file="$MONITORING/grafana/dashboards/" \
  --dry-run=client -o yaml | kubectl label --local -f - grafana_dashboard=1 -o yaml | kubectl apply -f -

echo "GRAFANA_PASSWORD=$grafana_pw" >> "$ENV_FILE"
log "Supervision installée"
