#!/usr/bin/env bash
# Génère infra/.env avec des mots de passe aléatoires (jamais versionné : .env est dans .gitignore).
# Si infra/.env existe déjà, seules les variables manquantes (nouveau service, par exemple) sont ajoutées :
# les mots de passe existants ne changent pas. --force régénère tout le fichier.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
pw() { openssl rand -hex 16; }
umask 077

VARIABLES="CATALOG_DB_PASSWORD ORDERS_DB_PASSWORD STOCK_DB_PASSWORD COMMUNITY_DB_PASSWORD EDITORIAL_DB_PASSWORD RABBIT_PASSWORD
KEYCLOAK_ADMIN_PASSWORD GRAFANA_ADMIN_PASSWORD PME_ALICE_PASSWORD PME_BOB_PASSWORD PME_CAROL_PASSWORD
PME_ADMIN_PME_PASSWORD"

if [ -f .env ] && [ "${1:-}" != "--force" ]; then
  ajoutees=""
  for variable in $VARIABLES; do
    if ! grep -q "^${variable}=" .env; then
      echo "${variable}=$(pw)" >> .env
      ajoutees="$ajoutees $variable"
    fi
  done
  if [ -n "$ajoutees" ]; then
    echo "infra/.env complété :$ajoutees (les autres valeurs sont inchangées)."
  else
    echo "infra/.env existe déjà et est complet (utilisez --force pour le régénérer)."
  fi
  exit 0
fi

: > .env
for variable in $VARIABLES; do
  echo "${variable}=$(pw)" >> .env
done
echo "infra/.env créé (droits 600). Comptes de test : alice (CUSTOMER), bob (sans rôle), carol (CUSTOMER), admin-pme (ADMIN)."
# Dans un GitHub Codespace, le navigateur ne voit pas localhost : adresse publique du site (infra/codespaces.sh)
if [ -n "${CODESPACE_NAME:-}" ]; then ./codespaces.sh; fi
