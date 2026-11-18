import { appelApi } from './client';
import type { Product, TokenProvider } from './types';

/** Produit recommandé et raison affichée (transparence de la personnalisation). */
export interface Recommandation {
  product: Product;
  reason: string;
}

export interface Recommandations {
  /** Le membre a activé la personnalisation : le site peut alors envoyer ses signaux d'intérêt. */
  personalized: boolean;
  items: Recommandation[];
}

export type SignalInteret =
  | { kind: 'VIEW' | 'PURCHASE'; productId: string }
  | { kind: 'SEARCH'; category: string };

/** Ouvert à tous ; le jeton (facultatif) personnalise la sélection d'un membre consentant. */
export function lireRecommandations(token?: TokenProvider, exclure?: string, signal?: AbortSignal) {
  const params = exclure ? `?exclude=${encodeURIComponent(exclure)}` : '';
  return appelApi<Recommandations>(`/api/v1/recommendations${params}`, { token, signal });
}

/** Signal d'intérêt (consultation, recherche, achat), sans effet si le membre n'a pas consenti. */
export function signalerInteret(signal: SignalInteret, token: TokenProvider) {
  return appelApi<undefined>('/api/v1/interests', { method: 'POST', body: signal, token });
}

/** Envoi « au mieux » : un signal perdu n'affecte que la qualité des recommandations. */
export function signalerSansAttendre(signal: SignalInteret, token: TokenProvider): void {
  signalerInteret(signal, token).catch(() => undefined);
}

export function lirePersonnalisation(token: TokenProvider, signal?: AbortSignal) {
  return appelApi<{ personalized: boolean }>('/api/v1/interests/preferences', { token, signal });
}

export function enregistrerPersonnalisation(active: boolean, token: TokenProvider) {
  return appelApi<{ personalized: boolean }>('/api/v1/interests/preferences', {
    method: 'PUT',
    body: { personalized: active },
    token,
  });
}

export function effacerHistorique(token: TokenProvider) {
  return appelApi<undefined>('/api/v1/interests', { method: 'DELETE', token });
}
