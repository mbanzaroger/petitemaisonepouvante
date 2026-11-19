import { createContext, useContext } from 'react';
import type { TokenProvider } from '../api/types';

export const ROLE_CLIENT = 'CUSTOMER';
export const ROLE_ADMIN = 'ADMIN';
export type Role = typeof ROLE_CLIENT | typeof ROLE_ADMIN;
/** Accès « membre » de l'espace communautaire : rôle client ou administrateur. */
export const ACCES_MEMBRE = 'MEMBRE';

export interface EtatAuth {
  /** L'initialisation (vérification silencieuse de la session) est terminée. */
  pret: boolean;
  connecte: boolean;
  utilisateur?: string;
  roles: readonly string[];
  /** La session n'a pas pu être établie (serveur d'authentification injoignable ou retour de connexion en échec). */
  echecConnexion?: boolean;
}

/**
 * Source d'authentification découplée de React (Keycloak en production, double de test sinon).
 * Les jetons restent en mémoire : ni localStorage ni sessionStorage (politique de sécurité, ADR-002 révisé).
 */
export interface SourceAuth {
  etat(): EtatAuth;
  abonner(rappel: () => void): () => void;
  connecter(): void;
  deconnecter(): void;
  /** Ferme la session en cours puis affiche le formulaire de connexion, en revenant sur la même page. */
  changerDeCompte(): void;
  jeton: TokenProvider;
}

export interface Auth extends EtatAuth {
  connecter(): void;
  deconnecter(): void;
  changerDeCompte(): void;
  jeton: TokenProvider;
}

export const AuthContext = createContext<Auth | null>(null);

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth doit être utilisé sous <AuthProvider>');
  return auth;
}

export function aLeRole(auth: EtatAuth, role: Role): boolean {
  return auth.connecte && auth.roles.includes(role);
}

export function estClient(auth: EtatAuth): boolean {
  return aLeRole(auth, ROLE_CLIENT);
}

export function estAdmin(auth: EtatAuth): boolean {
  return aLeRole(auth, ROLE_ADMIN);
}

/** Membre de l'espace communautaire : compte client ou administrateur (le service applique la même règle). */
export function estMembre(auth: EtatAuth): boolean {
  return estClient(auth) || estAdmin(auth);
}

/** Profil affiché à côté du nom de l'utilisateur connecté (en-tête, panier). */
export function libelleProfil(auth: EtatAuth): string {
  if (estAdmin(auth)) return 'Administrateur';
  if (estClient(auth)) return 'Client';
  return 'Sans profil client';
}
