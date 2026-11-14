#!/usr/bin/env bash
# Expérimentation E1 (#18) : Gateway API (Envoy Gateway) + cert-manager + Keycloak sur un cluster Kubernetes local.
# Prérequis : un cluster vide (kind, k3s, Minikube) dans le contexte kubectl courant ; helm, kubectl, jq, openssl, curl.
# Usage : experiments/e1/run.sh   (résultats dans experiments/e1/resultats/)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
EG_VERSION="${EG_VERSION:-v1.10.0}"
CM_VERSION="${CM_VERSION:-v1.21.3}"
OUT="${OUT:-$PWD/resultats}"
mkdir -p "$OUT"
log() { printf '\n\033[1;34m▸ %s\033[0m\n' "$*"; }
t0=$(date +%s)
elapsed() { echo $(( $(date +%s) - t0 )); }

log "1. Envoy Gateway $EG_VERSION (installe aussi les CRD Gateway API)"
helm upgrade --install eg oci://docker.io/envoyproxy/gateway-helm --version "$EG_VERSION" \
  -n envoy-gateway-system --create-namespace --wait --timeout 5m
echo "envoy_gateway_pret_s=$(elapsed)" >> "$OUT/durees.txt"

log "2. cert-manager $CM_VERSION avec prise en charge de Gateway API"
helm repo add jetstack https://charts.jetstack.io --force-update >/dev/null
helm upgrade --install cert-manager jetstack/cert-manager --version "$CM_VERSION" \
  -n cert-manager --create-namespace --set crds.enabled=true \
  --set config.apiVersion=controller.config.cert-manager.io/v1alpha1 \
  --set config.kind=ControllerConfiguration --set config.enableGatewayAPI=true \
  --wait --timeout 5m
echo "cert_manager_pret_s=$(elapsed)" >> "$OUT/durees.txt"

log "3. Autorité de certification du bac à sable"
kubectl apply -f 01-pki.yaml
kubectl -n cert-manager wait certificate/pme-ca --for=condition=Ready --timeout=120s

log "4. Gateway HTTPS *.pme.local"
kubectl apply -f 02-gateway.yaml

log "5. Keycloak (secrets générés à l'exécution, jamais versionnés)"
admin_pw=$(openssl rand -base64 24); alice_pw=$(openssl rand -hex 16); bob_pw=$(openssl rand -hex 16)
kubectl -n pme create secret generic keycloak-admin --from-literal=password="$admin_pw" \
  --dry-run=client -o yaml | kubectl apply -f -
sed -e "s/__ALICE_PASSWORD__/$alice_pw/" -e "s/__BOB_PASSWORD__/$bob_pw/" realm-pme.json > "$OUT/.realm.json"
kubectl -n pme create configmap keycloak-realm --from-file=realm-pme.json="$OUT/.realm.json" \
  --dry-run=client -o yaml | kubectl apply -f -
rm -f "$OUT/.realm.json"
kubectl apply -f 03-keycloak.yaml

log "6. API de démonstration protégée par JWT au niveau du Gateway"
kubectl apply -f 04-api.yaml

log "7. Attente des composants"
kubectl -n pme wait deploy/echo --for=condition=Available --timeout=180s
kubectl -n pme wait deploy/keycloak --for=condition=Available --timeout=420s
echo "keycloak_pret_s=$(elapsed)" >> "$OUT/durees.txt"
kubectl -n pme wait gateway/pme-gateway --for=condition=Programmed --timeout=180s
kubectl -n pme wait certificate/pme-wildcard-tls --for=condition=Ready --timeout=180s
echo "certificat_emis_s=$(elapsed)" >> "$OUT/durees.txt"
kubectl -n pme wait securitypolicy/api-jwt --for=jsonpath='{.status.ancestors[0].conditions[?(@.type=="Accepted")].status}'=True --timeout=120s

log "8. Accès au Gateway (redirection de port locale)"
svc=$(kubectl -n envoy-gateway-system get svc \
  -l gateway.envoyproxy.io/owning-gateway-name=pme-gateway,gateway.envoyproxy.io/owning-gateway-namespace=pme \
  -o jsonpath='{.items[0].metadata.name}')
kubectl -n envoy-gateway-system port-forward "svc/$svc" 8443:443 >/dev/null 2>&1 &
pf=$!
trap 'kill $pf 2>/dev/null || true' EXIT
sleep 4
kubectl -n cert-manager get secret pme-ca -o jsonpath='{.data.ca\.crt}' | base64 -d > "$OUT/ca.crt"
curl_pme() { curl -sS --cacert "$OUT/ca.crt" --resolve keycloak.pme.local:8443:127.0.0.1 --resolve api.pme.local:8443:127.0.0.1 "$@"; }

log "9. TLS : chaîne de confiance et contenu du certificat"
openssl s_client -connect 127.0.0.1:8443 -servername api.pme.local -CAfile "$OUT/ca.crt" </dev/null 2>/dev/null > "$OUT/tls-handshake.txt" || true
openssl x509 -in <(openssl s_client -connect 127.0.0.1:8443 -servername api.pme.local </dev/null 2>/dev/null) \
  -noout -subject -issuer -dates -serial -ext subjectAltName > "$OUT/certificat.txt"
cat "$OUT/certificat.txt"
tls_verify=$(grep -m1 "Verify return code" "$OUT/tls-handshake.txt" || echo "absent")
tls_proto=$(grep -m1 -E "Protocol *:|New, TLS" "$OUT/tls-handshake.txt" || echo "?")

log "10. Jetons Keycloak (flux mot de passe, client de test uniquement)"
token() {
  for _ in $(seq 1 30); do
    t=$(curl_pme -X POST https://keycloak.pme.local:8443/realms/pme/protocol/openid-connect/token \
      -d grant_type=password -d client_id=pme-tests -d username="$1" --data-urlencode password="$2" | jq -r '.access_token // empty') || true
    if [ -n "$t" ]; then echo "$t"; return 0; fi
    sleep 3
  done
  echo "Impossible d'obtenir un jeton pour $1" >&2; return 1
}
alice=$(token alice "$alice_pw"); bob=$(token bob "$bob_pw")
claims() {
  python3 -c 'import sys,base64,json; p=sys.argv[1].split(".")[1]; p+="="*(-len(p)%4); print(json.dumps(json.loads(base64.urlsafe_b64decode(p))))' "$1" \
    | jq '{iss, aud, azp, preferred_username, realm_access, exp, iat}'
}
claims "$alice" > "$OUT/jeton-alice.json"; claims "$bob" > "$OUT/jeton-bob.json"
cat "$OUT/jeton-alice.json"

log "11. Contrôle d'accès au Gateway"
status() { curl_pme -o /dev/null -w '%{http_code}' https://api.pme.local:8443/api/ping "$@"; }
sig="${alice##*.}"; c="${sig:10:1}"; [ "$c" = "A" ] && n=B || n=A
tampered="${alice%.*}.${sig:0:10}${n}${sig:11}"   # signature altérée au milieu
for _ in $(seq 1 20); do [ "$(status -H "Authorization: Bearer $alice")" = "200" ] && break; sleep 3; done
declare -A attendu=( [sans_jeton]=401 [jeton_altere]=401 [bob_sans_role]=403 [alice_customer]=200 )
declare -A obtenu
obtenu[sans_jeton]=$(status)
obtenu[jeton_altere]=$(status -H "Authorization: Bearer $tampered")
obtenu[bob_sans_role]=$(status -H "Authorization: Bearer $bob")
obtenu[alice_customer]=$(status -H "Authorization: Bearer $alice")
corps=$(curl_pme https://api.pme.local:8443/api/ping -H "Authorization: Bearer $alice")

log "12. Renouvellement automatique du certificat (durée 1 h, renouvellement 59 min 30 s avant)"
rev1=$(kubectl -n pme get certificate pme-wildcard-tls -o jsonpath='{.status.revision}')
serial1=$(kubectl -n pme get secret pme-wildcard-tls -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -noout -serial)
rev2=$rev1
for _ in $(seq 1 40); do
  rev2=$(kubectl -n pme get certificate pme-wildcard-tls -o jsonpath='{.status.revision}')
  [ "$rev2" -gt "$rev1" ] && break; sleep 5
done
serial2=$(kubectl -n pme get secret pme-wildcard-tls -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -noout -serial)
renouvele=$([ "$rev2" -gt "$rev1" ] && [ "$serial1" != "$serial2" ] && echo oui || echo non)

log "13. Inventaire"
kubectl get gatewayclass,gateway,httproute -A -o wide > "$OUT/inventaire.txt" 2>&1
kubectl get certificate,certificaterequest,clusterissuer -A >> "$OUT/inventaire.txt" 2>&1
kubectl get securitypolicy -A >> "$OUT/inventaire.txt" 2>&1
kubectl get pods -A -o wide >> "$OUT/inventaire.txt" 2>&1
helm list -A >> "$OUT/inventaire.txt" 2>&1
echo "total_s=$(elapsed)" >> "$OUT/durees.txt"

ok=true
{
  echo "### Expérimentation E1 — résultats"
  echo "| Contrôle | Attendu | Obtenu | |"
  echo "|---|---|---|---|"
  for k in sans_jeton jeton_altere bob_sans_role alice_customer; do
    r="✅"; [ "${obtenu[$k]}" = "${attendu[$k]}" ] || { r="❌"; ok=false; }
    echo "| $k | ${attendu[$k]} | ${obtenu[$k]} | $r |"
  done
  r="✅"; [ "$corps" = "pong" ] || { r="❌"; ok=false; }; echo "| corps de la réponse (alice) | pong | $corps | $r |"
  r="✅"; grep -q "0 (ok)" <<< "$tls_verify" || { r="❌"; ok=false; }; echo "| chaîne TLS vérifiée par l'AC du bac à sable | 0 (ok) | ${tls_verify#*: } | $r |"
  r="✅"; [ "$renouvele" = "oui" ] || { r="❌"; ok=false; }; echo "| renouvellement automatique | révision +1, nouveau numéro de série | révision $rev1 → $rev2 | $r |"
  echo ""
  echo "Protocole TLS : ${tls_proto}"
  echo ""
  echo '```'; cat "$OUT/durees.txt"; echo '```'
} | tee "$OUT/resultats.md"
[ -n "${GITHUB_STEP_SUMMARY:-}" ] && cat "$OUT/resultats.md" >> "$GITHUB_STEP_SUMMARY"
$ok
