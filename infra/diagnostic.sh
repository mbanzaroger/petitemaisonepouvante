#!/usr/bin/env bash
# Diagnostic de l'environnement local (docker compose), y compris dans un GitHub Codespace.
# Vérifie la configuration (.env), l'état des conteneurs, la cohérence des adresses Keycloak (site, royaume,
# services) et la santé des microservices ; affiche la correction à appliquer pour chaque point en échec.
# Usage : bash infra/diagnostic.sh   (aucun secret n'est affiché)
set -uo pipefail
cd "$(dirname "$0")" || exit 1
# Les microservices et le site sont dans le profil « app » de docker-compose.yml.
export COMPOSE_PROFILES="${COMPOSE_PROFILES:-app}"

ok=0; ko=0
succes() { printf '  \033[32m✔\033[0m %s\n' "$1"; ok=$((ok + 1)); }
echec() { printf '  \033[31m✘\033[0m %s\n      → %s\n' "$1" "$2"; ko=$((ko + 1)); }
info() { printf '\n\033[1m%s\033[0m\n' "$1"; }
valeur_env() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2-; }

info "1. Configuration (infra/.env)"
if [ ! -f .env ]; then
  echec ".env absent" "bash infra/init-env.sh"
  exit 1
fi
succes ".env présent"
site=$(valeur_env PME_SITE_URL); site=${site:-http://localhost:5173}
keycloak=$(valeur_env KEYCLOAK_PUBLIC_URL); keycloak=${keycloak:-http://localhost:8080}
echo "      adresse du site : $site"
echo "      adresse publique de Keycloak : $keycloak"
if [ -n "${CODESPACE_NAME:-}" ]; then
  attendu="https://${CODESPACE_NAME}-5173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
  if [ "$site" = "$attendu" ] && [ "$keycloak" = "$attendu" ]; then
    succes "mode Codespaces configuré pour ce Codespace"
  else
    echec "mode Codespaces non configuré (attendu : $attendu)" \
      "bash infra/codespaces.sh puis (cd infra && docker compose --profile app up -d --build --force-recreate)"
  fi
fi

info "2. Conteneurs"
if ! docker compose ps >/dev/null 2>&1; then
  echec "docker compose ne répond pas" "vérifier que Docker est démarré"
  exit 1
fi
attendus="catalog-db orders-db stock-db community-db editorial-db rabbitmq keycloak catalog-service order-service stock-service community-service editorial-service web-frontend"
for service in $attendus; do
  etat=$(docker compose ps -a --format '{{.Service}} {{.State}} {{.Health}}' 2>/dev/null | awk -v s="$service" '$1 == s { print $2, $3 }')
  if ! docker compose config --services 2>/dev/null | grep -qx "$service"; then
    continue
  fi
  case "$etat" in
    "running healthy" | "running ") succes "$service : démarré" ;;
    "running starting") echec "$service : en cours de démarrage" "patienter une minute puis relancer ce diagnostic" ;;
    "")
      echec "$service : absent" "(cd infra && docker compose --profile app up -d --build)" ;;
    *)
      echec "$service : $etat" "docker compose logs --tail=80 $service"
      docker compose logs --tail=15 "$service" 2>/dev/null | sed 's/^/        /'
      ;;
  esac
done

info "3. Site et Keycloak"
hote=${site#*://}
config=$(curl -fsS -H "Host: $hote" http://127.0.0.1:5173/config.json 2>/dev/null)
if [ -z "$config" ]; then
  echec "le site ne répond pas sur le port 5173" "docker compose --profile app up -d web-frontend"
else
  url_config=$(printf '%s' "$config" | sed -n 's/.*"keycloakUrl":"\([^"]*\)".*/\1/p')
  if [ "$url_config" = "$keycloak" ]; then
    succes "le site utilise Keycloak à l'adresse $url_config"
  else
    echec "le site utilise Keycloak à l'adresse « $url_config » au lieu de « $keycloak »" \
      "(cd infra && docker compose --profile app up -d --force-recreate web-frontend)"
  fi
fi

if [ "$keycloak" = "$site" ]; then
  decouverte="http://127.0.0.1:5173/realms/pme/.well-known/openid-configuration"
else
  decouverte="http://127.0.0.1:8080/realms/pme/.well-known/openid-configuration"
fi
emetteur=$(curl -fsS -H "Host: $hote" "$decouverte" 2>/dev/null | sed -n 's/.*"issuer":"\([^"]*\)".*/\1/p')
if [ -z "$emetteur" ]; then
  echec "Keycloak ne répond pas ($decouverte)" "docker compose logs --tail=80 keycloak"
elif [ "$emetteur" = "$keycloak/realms/pme" ]; then
  succes "émetteur des jetons : $emetteur"
else
  echec "émetteur des jetons « $emetteur » différent de « $keycloak/realms/pme »" \
    "(cd infra && docker compose --profile app up -d --force-recreate keycloak)"
fi

# Le royaume doit accepter le retour vers le site après connexion (sinon « Invalid parameter: redirect_uri »).
base_auth=${decouverte%/.well-known/openid-configuration}
code=$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $hote" \
  "$base_auth/protocol/openid-connect/auth?client_id=pme-web&response_type=code&scope=openid&code_challenge_method=S256&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&redirect_uri=$(printf '%s' "$site/" | sed 's#:#%3A#g; s#/#%2F#g')")
# 200 : page de connexion ; 400 : adresse de retour refusée par le client pme-web.
if [ "$code" = "200" ] || [ "$code" = "302" ]; then
  succes "retour vers $site/ autorisé après connexion"
else
  echec "Keycloak refuse le retour vers $site/ (HTTP $code)" \
    "bash infra/codespaces.sh (Codespace) puis (cd infra && docker compose --profile app up -d --force-recreate keycloak)"
fi

info "4. Microservices (validation des jetons et santé)"
for paire in catalog-service:8081 order-service:8082 stock-service:8083 community-service:8084 editorial-service:8085; do
  service=${paire%%:*}; port=${paire##*:}
  docker compose config --services 2>/dev/null | grep -qx "$service" || continue
  conteneur=$(docker compose ps -q "$service" 2>/dev/null)
  if [ -z "$conteneur" ]; then
    echec "$service : non démarré" "(cd infra && docker compose --profile app up -d --build $service)"
    continue
  fi
  emetteur_service=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$conteneur" | sed -n 's/^JWT_ISSUER_URI=//p')
  if [ "$emetteur_service" = "$keycloak/realms/pme" ]; then
    succes "$service attend l'émetteur $emetteur_service"
  else
    echec "$service attend l'émetteur « $emetteur_service » (jetons refusés : 401)" \
      "(cd infra && docker compose --profile app up -d --force-recreate $service)"
  fi
  sante=$(curl -fsS "http://127.0.0.1:$port/actuator/health" 2>/dev/null)
  case "$sante" in
    *'"UP"'*) succes "$service : en bonne santé" ;;
    *) echec "$service : santé indisponible" "docker compose logs --tail=80 $service" ;;
  esac
  refus=$(docker compose logs --since 30m "$service" 2>/dev/null | grep -ciE 'invalid_token|JwtValidationException|Bearer error')
  if [ "${refus:-0}" -gt 0 ]; then
    echec "$service : $refus jeton(s) refusé(s) dans les 30 dernières minutes" \
      "se déconnecter puis se reconnecter sur le site ; si cela persiste, recréer Keycloak et $service"
  fi
done

info "Comptes de test (mots de passe dans infra/.env)"
echo "      alice, carol : clients (commandes, troc, fanzine)"
echo "      bob          : compte sans profil client (refus attendus)"
echo "      admin-pme    : administrateur (produits, stock, commandes clients, modération, rédaction)"

printf '\nRésultat : %d vérification(s) réussie(s), %d en échec.\n' "$ok" "$ko"
[ "$ko" -eq 0 ]
