import { createContext, useContext } from 'react';
import type { Product } from '../api/types';
import type { LignePanier } from './panier';

export interface Panier {
  lignes: LignePanier[];
  nombreArticles: number;
  totalCentimes: number;
  /** Ajoute le produit et renvoie le message à annoncer à l'utilisateur. */
  ajouter(produit: Product, quantite: number): string;
  modifierQuantite(productId: string, quantite: number): void;
  /** Met le panier à jour avec le catalogue et renvoie les changements de prix à annoncer. */
  synchroniser(produits: Product[]): string[];
  retirer(productId: string): void;
  vider(): void;
}

export const PanierContext = createContext<Panier | null>(null);

export function usePanier(): Panier {
  const panier = useContext(PanierContext);
  if (!panier) throw new Error('usePanier doit être utilisé sous <PanierProvider>');
  return panier;
}
