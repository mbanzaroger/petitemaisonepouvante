import { appelApi } from './client';
import type { NiveauStock } from './stock';
import type { Order, OrderStatus, Page, Product, TokenProvider } from './types';

/** US18 — données d'un produit saisies par l'administrateur (prix en centimes). */
export interface ProduitSaisi {
  name: string;
  description: string;
  priceCents: number;
  category: string;
  exclusive: boolean;
}

export const TAILLE_PAGE_ADMIN = 20;

/** Tous les produits, en vente ou retirés, les plus récents d'abord (ADMIN). */
export function listerProduitsAdmin(page: number, token: TokenProvider, signal?: AbortSignal): Promise<Page<Product>> {
  const params = new URLSearchParams({ page: String(page), size: String(TAILLE_PAGE_ADMIN) });
  return appelApi<Page<Product>>(`/api/v1/catalog/admin/products?${params.toString()}`, { token, signal });
}

export function creerProduit(produit: ProduitSaisi & { sku: string }, token: TokenProvider): Promise<Product> {
  return appelApi<Product>('/api/v1/catalog/admin/products', { method: 'POST', body: produit, token });
}

/** Modifie un produit ; {@code active: false} le retire de la vente sans le supprimer. */
export function modifierProduit(
  id: string,
  produit: ProduitSaisi & { active: boolean },
  token: TokenProvider,
): Promise<Product> {
  return appelApi<Product>(`/api/v1/catalog/admin/products/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: produit,
    token,
  });
}

/** Ajoute des unités au stock disponible (crée le stock d'un nouveau produit). */
export function reapprovisionner(productId: string, quantity: number, token: TokenProvider): Promise<NiveauStock> {
  return appelApi<NiveauStock>(`/api/v1/stock/${encodeURIComponent(productId)}/restock`, {
    method: 'POST',
    body: { quantity },
    token,
  });
}

/** US19 — commande vue par l'administrateur : nom affiché du client (vide pour les commandes anciennes). */
export interface CommandeAdmin extends Order {
  customerName: string | null;
}

export interface SyntheseCommandes {
  countsByStatus: Record<OrderStatus, number>;
  confirmedRevenueCents: number;
  currency: string;
}

export function listerCommandesAdmin(
  { page, statut }: { page: number; statut?: OrderStatus },
  token: TokenProvider,
  signal?: AbortSignal,
): Promise<Page<CommandeAdmin>> {
  const params = new URLSearchParams({ page: String(page), size: String(TAILLE_PAGE_ADMIN) });
  if (statut) params.set('status', statut);
  return appelApi<Page<CommandeAdmin>>(`/api/v1/orders/admin?${params.toString()}`, { token, signal });
}

export function lireSyntheseCommandes(token: TokenProvider, signal?: AbortSignal): Promise<SyntheseCommandes> {
  return appelApi<SyntheseCommandes>('/api/v1/orders/admin/summary', { token, signal });
}

/** « 12,90 », « 12.9 » ou « 12 » (euros) → centimes ; null si la saisie n'est pas un montant positif valide. */
export function centimesDepuisSaisie(saisie: string): number | null {
  const normalise = saisie.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(normalise)) return null;
  const centimes = Math.round(Number.parseFloat(normalise) * 100);
  return centimes >= 1 ? centimes : null;
}
