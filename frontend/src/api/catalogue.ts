import { appelApi } from './client';
import type { Page, Product } from './types';

export const TAILLE_PAGE_CATALOGUE = 12;

export function listerProduits(
  { page = 0, categorie }: { page?: number; categorie?: string },
  signal?: AbortSignal,
): Promise<Page<Product>> {
  const params = new URLSearchParams({ page: String(page), size: String(TAILLE_PAGE_CATALOGUE) });
  if (categorie) params.set('category', categorie);
  return appelApi<Page<Product>>(`/api/v1/products?${params.toString()}`, { signal });
}

export function lireProduit(id: string, signal?: AbortSignal): Promise<Product> {
  return appelApi<Product>(`/api/v1/products/${encodeURIComponent(id)}`, { signal });
}

export function listerCategories(signal?: AbortSignal): Promise<string[]> {
  return appelApi<string[]>('/api/v1/categories', { signal });
}
