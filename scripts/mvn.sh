#!/usr/bin/env bash
# Lance Maven dans le répertoire courant (CI, CD, release) : le Maven Wrapper du module quand sa
# distribution est disponible, sinon le Maven installé sur le runner GitHub.
# Maven Central refuse parfois le téléchargement de la distribution aux runners (« wget: Failed to
# fetch ») ; le build échouait alors avant toute compilation. Deux essais espacés, puis repli signalé
# par un avertissement dans le résumé du workflow. Les dépendances viennent du cache de setup-java.
set -euo pipefail

if [ -x ./mvnw ]; then
  for essai in 1 2; do
    if ./mvnw -q -v >/dev/null 2>&1; then
      exec ./mvnw "$@"
    fi
    [ "$essai" -eq 2 ] || sleep 20
  done
  if command -v mvn >/dev/null; then
    echo "::warning::Distribution du Maven Wrapper non téléchargeable : Maven du runner utilisé ($(mvn -v | head -n 1))."
  fi
fi
exec mvn "$@"
