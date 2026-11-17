#!/usr/bin/env bash
# Génère infra/.env avec des mots de passe aléatoires (jamais versionné : .env est dans .gitignore).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
if [ -f .env ] && [ "${1:-}" != "--force" ]; then
  echo "infra/.env existe déjà (utilisez --force pour le régénérer)."; exit 0
fi
pw() { openssl rand -hex 16; }
umask 077
cat > .env <<ENV
CATALOG_DB_PASSWORD=$(pw)
ORDERS_DB_PASSWORD=$(pw)
STOCK_DB_PASSWORD=$(pw)
RABBIT_PASSWORD=$(pw)
KEYCLOAK_ADMIN_PASSWORD=$(pw)
GRAFANA_ADMIN_PASSWORD=$(pw)
PME_ALICE_PASSWORD=$(pw)
PME_BOB_PASSWORD=$(pw)
PME_CAROL_PASSWORD=$(pw)
PME_ADMIN_PME_PASSWORD=$(pw)
ENV
echo "infra/.env créé (droits 600). Comptes de test : alice (CUSTOMER), bob (sans rôle), carol (CUSTOMER), admin-pme (ADMIN)."
# Dans un GitHub Codespace, le navigateur ne voit pas localhost : adresse publique du site (infra/codespaces.sh)
if [ -n "${CODESPACE_NAME:-}" ]; then ./codespaces.sh; fi
