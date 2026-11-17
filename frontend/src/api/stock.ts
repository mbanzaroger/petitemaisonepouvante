import { ApiError, appelApi } from './client';
import type { TokenProvider } from './types';

export interface NiveauStock {
  productId: string;
  available: number;
  reserved: number;
}

/** Seuil d'alerte affiché aux administrateurs (stock disponible faible). */
export const SEUIL_STOCK_BAS = 5;

/** Stock d'un produit (rôle ADMIN) ; null si le produit n'est pas suivi en stock (404). */
export async function lireStock(productId: string, token: TokenProvider, signal?: AbortSignal): Promise<NiveauStock | null> {
  try {
    return await appelApi<NiveauStock>(`/api/v1/stock/${encodeURIComponent(productId)}`, { token, signal });
  } catch (erreur) {
    if (erreur instanceof ApiError && erreur.status === 404) return null;
    throw erreur;
  }
}

export type EtatStock = 'non-suivi' | 'epuise' | 'bas' | 'correct';

export const LIBELLES_ETAT: Record<EtatStock, string> = {
  'non-suivi': 'Non suivi',
  epuise: 'Épuisé',
  bas: 'Stock bas',
  correct: 'Correct',
};

export function etatStock(niveau: NiveauStock | null): EtatStock {
  if (!niveau) return 'non-suivi';
  if (niveau.available === 0) return 'epuise';
  return niveau.available <= SEUIL_STOCK_BAS ? 'bas' : 'correct';
}
