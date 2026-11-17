#!/usr/bin/env bash
# Mode GitHub Codespaces : les conteneurs tournent dans le Codespace, le navigateur passe par l'adresse
# https://<codespace>-5173.<domaine de redirection> et non par localhost. Ce script écrit dans infra/.env :
#   PME_SITE_URL         adresse publique du site (redirection autorisée pour le client Keycloak pme-web)
#   KEYCLOAK_PUBLIC_URL  même adresse : Keycloak est relayé par le site (/realms, /resources, infra/web/api.conf)
# Un seul port à rediriger (5173), aucune requête entre origines, et l'émetteur des jetons est cohérent pour les services.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
if [ -z "${CODESPACE_NAME:-}" ]; then
  echo "Pas de Codespace détecté (CODESPACE_NAME vide) : rien à faire, le site est sur http://localhost:5173."; exit 0
fi
[ -f .env ] || ./init-env.sh
site="https://${CODESPACE_NAME}-5173.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
definir() { # definir <variable> <valeur> : remplace ou ajoute la ligne dans .env
  if grep -q "^$1=" .env; then sed -i "s#^$1=.*#$1=$2#" .env; else echo "$1=$2" >> .env; fi
}
definir PME_SITE_URL "$site"
definir KEYCLOAK_PUBLIC_URL "$site"
cat <<MSG
Mode Codespaces configuré dans infra/.env : $site
Appliquer (Keycloak réimporte le royaume, les services relisent l'émetteur des jetons) :
  cd infra && docker compose --profile app up -d --build --force-recreate
Puis ouvrir $site
(onglet « Ports » : le port 5173 doit être redirigé ; visibilité « Private » suffit).
MSG
