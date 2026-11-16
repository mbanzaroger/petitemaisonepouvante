import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import type { Order, Page, Product } from '../api/types';
import { App } from '../App';
import type { EtatAuth, SourceAuth } from '../auth/auth';
import { AuthProvider } from '../auth/AuthProvider';
import { PanierProvider } from '../cart/PanierProvider';

export function fausseAuth(etat: Partial<EtatAuth> = {}) {
  const courant: EtatAuth = { pret: true, connecte: false, roles: [], ...etat };
  const source = {
    etat: () => courant,
    abonner: () => () => undefined,
    connecter: vi.fn(),
    deconnecter: vi.fn(),
    jeton: vi.fn(async () => (courant.connecte ? 'jeton-de-test' : undefined)),
  } satisfies SourceAuth;
  return source;
}

export const CLIENT: Partial<EtatAuth> = { connecte: true, utilisateur: 'alice', roles: ['CUSTOMER'] };

export function rendreApp(chemin: string, auth: SourceAuth = fausseAuth()) {
  const utilisateur = userEvent.setup();
  const rendu = render(
    <MemoryRouter initialEntries={[chemin]}>
      <AuthProvider source={auth}>
        <PanierProvider>
          <App />
        </PanierProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
  return { utilisateur, ...rendu };
}

type Gestionnaire = (url: URL, init: RequestInit) => Response | Promise<Response>;

export function json(corps: unknown, status = 200): Response {
  const type = status >= 400 ? 'application/problem+json' : 'application/json';
  return new Response(JSON.stringify(corps), { status, headers: { 'Content-Type': type } });
}

/** Remplace fetch : la clé est « MÉTHODE /chemin » (sans paramètres) ; une route absente répond 404. */
export function simulerApi(routes: Record<string, Gestionnaire>) {
  const espion = vi.fn(async (entree: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(entree), 'http://localhost');
    const gestionnaire = routes[`${init.method ?? 'GET'} ${url.pathname}`];
    return gestionnaire ? gestionnaire(url, init) : json({ title: 'Not Found', status: 404 }, 404);
  });
  vi.stubGlobal('fetch', espion);
  return espion;
}

export function produit(numero: number, surcharge: Partial<Product> = {}): Product {
  const nn = String(numero).padStart(2, '0');
  return {
    id: `0f6c1a10-00${nn}-4000-8000-0000000000${nn}`,
    sku: `PME-${nn}`,
    name: `Produit ${nn}`,
    description: `Description du produit ${nn}`,
    price: { amountCents: 1000 + numero, currency: 'EUR' },
    category: 'Goodies',
    available: true,
    ...surcharge,
  };
}

export function page<T>(contenu: T[], numero = 0, totalPages = 1, totalElements = contenu.length): Page<T> {
  return { content: contenu, page: numero, size: 12, totalElements, totalPages };
}

export function commande(surcharge: Partial<Order> = {}): Order {
  return {
    id: '9a1b2c3d-1111-4222-8333-444455556666',
    status: 'PENDING',
    totalCents: 2400,
    currency: 'EUR',
    createdAt: '2026-11-16T10:00:00Z',
    updatedAt: '2026-11-16T10:00:01Z',
    lines: [{ productId: produit(8).id, productName: 'Mug', quantity: 2, unitPriceCents: 1200, subtotalCents: 2400 }],
    ...surcharge,
  };
}
