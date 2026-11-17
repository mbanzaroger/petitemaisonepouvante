#!/usr/bin/env bash
# Socle de l'environnement de staging (appelé par .github/workflows/cd.yml, utilisable en local sur kind) :
# Envoy Gateway + cert-manager (TLS), Keycloak (OIDC), opérateur RabbitMQ, metrics-server, secrets générés à l'exécution.
# Exporte BASE_URL, KEYCLOAK_URL, PME_CA_CERT et les mots de passe de test (masqués dans les logs GitHub).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
EG_VERSION="${EG_VERSION:-v1.10.0}"
CM_VERSION="${CM_VERSION:-v1.21.3}"
RABBIT_OPERATOR_VERSION="${RABBIT_OPERATOR_VERSION:-v2.23.3}"
METRICS_SERVER_VERSION="${METRICS_SERVER_VERSION:-v0.9.1}"
WORK="${WORK:-${RUNNER_TEMP:-/tmp}/pme-staging}"; mkdir -p "$WORK"
ENV_FILE="${GITHUB_ENV:-$WORK/staging.env}"
log() { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }
# Secret aléatoire, puis masquage dans les logs GitHub : la commande ::add-mask:: doit sortir sur stdout,
# donc jamais à l'intérieur d'une substitution $(...) dont on capture la sortie.
gen_secret() { openssl rand -hex 16; }
mask() { if [ -n "${GITHUB_ACTIONS:-}" ]; then echo "::add-mask::$1"; fi; }

log "Envoy Gateway $EG_VERSION puis cert-manager $CM_VERSION (après les CRD Gateway API)"
helm upgrade --install eg oci://docker.io/envoyproxy/gateway-helm --version "$EG_VERSION" \
  -n envoy-gateway-system --create-namespace --wait --timeout 5m
helm repo add jetstack https://charts.jetstack.io --force-update >/dev/null
helm upgrade --install cert-manager jetstack/cert-manager --version "$CM_VERSION" \
  -n cert-manager --create-namespace --set crds.enabled=true \
  --set config.apiVersion=controller.config.cert-manager.io/v1alpha1 \
  --set config.kind=ControllerConfiguration --set config.enableGatewayAPI=true --wait --timeout 5m

log "Opérateur RabbitMQ $RABBIT_OPERATOR_VERSION"
kubectl apply -f "https://github.com/rabbitmq/cluster-operator/releases/download/$RABBIT_OPERATOR_VERSION/cluster-operator.yml"
kubectl -n rabbitmq-system rollout status deploy/rabbitmq-cluster-operator --timeout=180s

log "metrics-server $METRICS_SERVER_VERSION (mise à l'échelle horizontale, HPA)"
kubectl apply -f "https://github.com/kubernetes-sigs/metrics-server/releases/download/$METRICS_SERVER_VERSION/components.yaml"
# kind : certificats des kubelets auto-signés. Option réservée à ce cluster de test, jamais en production.
kubectl -n kube-system patch deployment metrics-server --type=json \
  -p '[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
kubectl -n kube-system rollout status deployment/metrics-server --timeout=180s

log "PKI, Gateway HTTPS *.pme.local"
kubectl apply -f platform/pki.yaml
kubectl -n cert-manager wait certificate/pme-ca --for=condition=Ready --timeout=120s
kubectl apply -f platform/gateway.yaml

log "Secrets générés à l'exécution (jamais versionnés)"
for db in catalog orders stock; do
  db_pw=$(gen_secret); mask "$db_pw"
  kubectl -n pme create secret generic "$db-db" --from-literal=username="$db" \
    --from-literal=password="$db_pw" --dry-run=client -o yaml | kubectl apply -f -
done
admin_pw=$(gen_secret); mask "$admin_pw"
kubectl -n pme create secret generic keycloak-admin --from-literal=password="$admin_pw" --dry-run=client -o yaml | kubectl apply -f -
alice_pw=$(gen_secret); bob_pw=$(gen_secret); carol_pw=$(gen_secret); adminpme_pw=$(gen_secret)
for v in "$alice_pw" "$bob_pw" "$carol_pw" "$adminpme_pw"; do mask "$v"; done
sed -e "s/__ALICE_PASSWORD__/$alice_pw/" -e "s/__BOB_PASSWORD__/$bob_pw/" -e "s/__CAROL_PASSWORD__/$carol_pw/" \
    -e "s/__ADMIN_PME_PASSWORD__/$adminpme_pw/" platform/realm-pme.json > "$WORK/realm-pme.json"
kubectl -n pme create configmap keycloak-realm --from-file=realm-pme.json="$WORK/realm-pme.json" \
  --dry-run=client -o yaml | kubectl apply -f -
rm -f "$WORK/realm-pme.json"
# Thème de connexion « pme » (source unique : infra/keycloak/themes, monté aussi par docker compose)
theme=../infra/keycloak/themes/pme/login
kubectl -n pme create configmap keycloak-theme-pme \
  --from-file=theme.properties="$theme/theme.properties" \
  --from-file=pme.css="$theme/resources/css/pme.css" \
  --from-file=messages_fr.properties="$theme/messages/messages_fr.properties" \
  --dry-run=client -o yaml | kubectl apply -f -

log "Keycloak"
kubectl apply -f platform/keycloak.yaml
kubectl -n pme rollout status deploy/keycloak --timeout=420s
# Gateway « Programmed » : l'adresse du service NodePort peut tarder à être publiée (run du 15/11/2026).
if ! kubectl -n pme wait gateway/pme-gateway --for=condition=Programmed --timeout=360s; then
  kubectl -n pme get gateway pme-gateway -o jsonpath='{.status}' && echo
  exit 1
fi
kubectl -n pme wait certificate/pme-wildcard-tls --for=condition=Ready --timeout=180s

log "Accès local au Gateway (port 8443) et paramètres des tests"
svc=$(kubectl -n envoy-gateway-system get svc \
  -l gateway.envoyproxy.io/owning-gateway-name=pme-gateway,gateway.envoyproxy.io/owning-gateway-namespace=pme \
  -o jsonpath='{.items[0].metadata.name}')
nohup kubectl -n envoy-gateway-system port-forward "svc/$svc" 8443:443 > "$WORK/port-forward.log" 2>&1 &
kubectl -n cert-manager get secret pme-ca -o jsonpath='{.data.ca\.crt}' | base64 -d > "$WORK/ca.crt"
{
  echo "BASE_URL=https://api.pme.local:8443"
  echo "KEYCLOAK_URL=https://keycloak.pme.local:8443"
  echo "PME_CA_CERT=$WORK/ca.crt"
  echo "PME_ALICE_PASSWORD=$alice_pw"
  echo "PME_BOB_PASSWORD=$bob_pw"
  echo "PME_CAROL_PASSWORD=$carol_pw"
  echo "PME_ADMIN_PME_PASSWORD=$adminpme_pw"
} >> "$ENV_FILE"
log "Socle prêt (variables dans $ENV_FILE)"
