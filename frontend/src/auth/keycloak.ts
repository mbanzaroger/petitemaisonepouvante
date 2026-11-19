import Keycloak, { type KeycloakTokenParsed } from 'keycloak-js';
import type { AppConfig } from '../config';
import type { EtatAuth, SourceAuth } from './auth';

/** Marge de validité exigée avant chaque appel : le jeton est renouvelé s'il expire dans moins de 30 s. */
const MARGE_VALIDITE_S = 30;

/**
 * Paramètre posé sur l'adresse de retour de la déconnexion par « Changer de compte » : au retour, le formulaire de
 * connexion s'ouvre directement. Sans déconnexion préalable, Keycloak reconnecterait la session en cours (SSO).
 */
const PARAM_CONNEXION = 'connexion';

function adresseSans(parametre: string): string {
  const url = new URL(window.location.href);
  url.searchParams.delete(parametre);
  return url.toString();
}

type JetonPme = KeycloakTokenParsed & { preferred_username?: string };

export function etatDepuisKeycloak(pret: boolean, authentifie: boolean, jeton?: JetonPme, echec = false): EtatAuth {
  if (!authentifie || !jeton) {
    return echec ? { pret, connecte: false, roles: [], echecConnexion: true } : { pret, connecte: false, roles: [] };
  }
  return {
    pret,
    connecte: true,
    utilisateur: jeton.preferred_username,
    roles: jeton.realm_access?.roles ?? [],
  };
}

/**
 * Client OpenID Connect public « pme-web » : flux code d'autorisation + PKCE S256 (keycloak-js).
 * L'application s'affiche tout de suite ; la session existante est détectée en arrière-plan (check-sso silencieux).
 */
export function creerSourceKeycloak(config: AppConfig): SourceAuth & { demarrer(): Promise<void> } {
  const keycloak = new Keycloak({ url: config.keycloakUrl, realm: config.realm, clientId: config.clientId });
  const abonnes = new Set<() => void>();
  let pret = false;
  let echec = false;
  let etat: EtatAuth = etatDepuisKeycloak(false, false);

  const notifier = () => {
    etat = etatDepuisKeycloak(pret, keycloak.authenticated === true, keycloak.tokenParsed as JetonPme | undefined, echec);
    abonnes.forEach((rappel) => rappel());
  };
  keycloak.onAuthSuccess = notifier;
  keycloak.onAuthLogout = notifier;
  keycloak.onAuthRefreshSuccess = notifier;
  keycloak.onAuthRefreshError = () => void keycloak.clearToken();
  keycloak.onTokenExpired = () => void keycloak.updateToken(MARGE_VALIDITE_S).catch(() => keycloak.clearToken());

  return {
    async demarrer() {
      try {
        await keycloak.init({
          onLoad: 'check-sso',
          pkceMethod: 'S256',
          responseMode: 'fragment',
          checkLoginIframe: false,
          silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
          silentCheckSsoFallback: false,
        });
      } catch (erreur) {
        // Le site reste utilisable sans connexion ; l'utilisateur est prévenu (bandeau) au lieu d'un échec silencieux.
        echec = true;
        console.warn('Keycloak injoignable : navigation sans connexion', erreur);
      } finally {
        pret = true;
        notifier();
      }
      if (new URL(window.location.href).searchParams.has(PARAM_CONNEXION)) {
        const retour = adresseSans(PARAM_CONNEXION);
        window.history.replaceState(window.history.state, '', retour);
        if (!keycloak.authenticated && !echec) void keycloak.login({ redirectUri: retour });
      }
    },
    etat: () => etat,
    abonner(rappel) {
      abonnes.add(rappel);
      return () => abonnes.delete(rappel);
    },
    connecter() {
      void keycloak.login({ redirectUri: window.location.href });
    },
    deconnecter() {
      void keycloak.logout({ redirectUri: `${window.location.origin}/` });
    },
    changerDeCompte() {
      const retour = new URL(window.location.href);
      retour.searchParams.set(PARAM_CONNEXION, '1');
      void keycloak.logout({ redirectUri: retour.toString() });
    },
    async jeton() {
      if (!keycloak.authenticated) return undefined;
      try {
        await keycloak.updateToken(MARGE_VALIDITE_S);
        return keycloak.token;
      } catch {
        await keycloak.clearToken();
        return undefined;
      }
    },
  };
}
