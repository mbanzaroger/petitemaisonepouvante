// Vérification silencieuse de la session Keycloak (iframe) : script externe pour respecter la CSP (pas de script en ligne).
parent.postMessage(location.href, location.origin);
