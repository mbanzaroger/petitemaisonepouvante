import { createContext, useContext } from 'react';
import type { TokenProvider } from '../api/types';

export const ROLE_CLIENT = 'CUSTOMER';

export interface EtatAuth {
  /** L'initialisation (vérification silencieuse de la session) est terminée. */
  pret: boolean;
  connecte: boolean;
  utilisateur?: string;
  roles: readonly string[];
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
  jeton: TokenProvider;
}

export interface Auth extends EtatAuth {
  connecter(): void;
  deconnecter(): void;
  jeton: TokenProvider;
}

export const AuthContext = createContext<Auth | null>(null);

export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth doit être utilisé sous <AuthProvider>');
  return auth;
}

export function estClient(auth: EtatAuth): boolean {
  return auth.roles.includes(ROLE_CLIENT);
}
