import { appelApi } from './client';
import type { Order, OrderLineRequest, Page, TokenProvider } from './types';

export const TAILLE_PAGE_COMMANDES = 10;

export function passerCommande(lignes: OrderLineRequest[], token: TokenProvider): Promise<Order> {
  return appelApi<Order>('/api/v1/orders', { method: 'POST', body: { lines: lignes }, token });
}

export function listerCommandes(page: number, token: TokenProvider, signal?: AbortSignal): Promise<Page<Order>> {
  const params = new URLSearchParams({ page: String(page), size: String(TAILLE_PAGE_COMMANDES) });
  return appelApi<Page<Order>>(`/api/v1/orders?${params.toString()}`, { token, signal });
}

export function lireCommande(id: string, token: TokenProvider, signal?: AbortSignal): Promise<Order> {
  return appelApi<Order>(`/api/v1/orders/${encodeURIComponent(id)}`, { token, signal });
}
