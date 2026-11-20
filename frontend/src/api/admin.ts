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

/** US21 — formats et poids acceptés pour l'image d'un produit (contrôlés aussi par le catalogue). */
export const TYPES_IMAGE = ['image/jpeg', 'image/png', 'image/webp'];
export const POIDS_IMAGE_MAX = 2 * 1024 * 1024;

/** Message d'erreur si le fichier choisi ne peut pas servir d'image de produit, sinon null. */
export function verifierImage(fichier: File): string | null {
  if (!TYPES_IMAGE.includes(fichier.type)) return 'Choisissez une image JPEG, PNG ou WebP.';
  if (fichier.size > POIDS_IMAGE_MAX) return 'Image trop lourde : 2 Mo au plus.';
  return null;
}

/** Ajoute ou remplace l'image d'un produit ; renvoie le produit avec sa nouvelle adresse d'image. */
export function envoyerImage(id: string, image: File, token: TokenProvider): Promise<Product> {
  return appelApi<Product>(`/api/v1/catalog/admin/products/${encodeURIComponent(id)}/image`, {
    method: 'PUT',
    fichier: image,
    token,
  });
}

/** Retire l'image d'un produit (le site affiche alors le pictogramme de son rayon). */
export function retirerImage(id: string, token: TokenProvider): Promise<void> {
  return appelApi<void>(`/api/v1/catalog/admin/products/${encodeURIComponent(id)}/image`, { method: 'DELETE', token });
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
