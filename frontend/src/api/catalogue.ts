import { appelApi } from './client';
import type { Page, Product } from './types';

export const TAILLE_PAGE_CATALOGUE = 12;

/** US22 — tris du catalogue : valeur dans l'adresse du site → valeur de l'API. */
export const TRIS = {
  nom: { libelle: 'Nom (A à Z)', api: 'name' },
  'prix-croissant': { libelle: 'Prix croissant', api: 'price-asc' },
  'prix-decroissant': { libelle: 'Prix décroissant', api: 'price-desc' },
  nouveautes: { libelle: 'Nouveautés', api: 'newest' },
} as const;

export type Tri = keyof typeof TRIS;

export function estTri(valeur: string | null): valeur is Tri {
  return valeur !== null && Object.hasOwn(TRIS, valeur);
}

export function listerProduits(
  {
    page = 0,
    categorie,
    exclusif = false,
    recherche,
    tri = 'nom',
  }: { page?: number; categorie?: string; exclusif?: boolean; recherche?: string; tri?: Tri },
  signal?: AbortSignal,
): Promise<Page<Product>> {
  const params = new URLSearchParams({ page: String(page), size: String(TAILLE_PAGE_CATALOGUE) });
  if (categorie) params.set('category', categorie);
  if (exclusif) params.set('exclusive', 'true');
  if (recherche) params.set('q', recherche);
  if (tri !== 'nom') params.set('sort', TRIS[tri].api);
  return appelApi<Page<Product>>(`/api/v1/products?${params.toString()}`, { signal });
}

export function lireProduit(id: string, signal?: AbortSignal): Promise<Product> {
  return appelApi<Product>(`/api/v1/products/${encodeURIComponent(id)}`, { signal });
}

export function listerCategories(signal?: AbortSignal): Promise<string[]> {
  return appelApi<string[]>('/api/v1/categories', { signal });
}

/** Relecture groupée (50 identifiants au plus) : prix et disponibilité à jour des produits du panier. */
export function lireProduits(ids: string[], signal?: AbortSignal): Promise<Product[]> {
  const params = new URLSearchParams({ ids: ids.slice(0, 50).join(',') });
  return appelApi<Product[]>(`/api/v1/products?${params.toString()}`, { signal });
}
