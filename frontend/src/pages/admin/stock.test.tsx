import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { etatStock } from '../../api/stock';
import { CLIENT, fausseAuth, json, page, produit, rendreApp, simulerApi } from '../../test/outils';

afterEach(() => vi.unstubAllGlobals());

const ADMIN = { connecte: true, utilisateur: 'admin-pme', roles: ['ADMIN'] };

function api(appels: string[] = []) {
  const niveaux: Record<string, { available: number; reserved: number } | undefined> = {
    [produit(1).id]: { available: 120, reserved: 3 },
    [produit(2).id]: { available: 2, reserved: 0 },
    [produit(3).id]: { available: 0, reserved: 10 },
  };
  const routes: Parameters<typeof simulerApi>[0] = {
    'GET /api/v1/products': (url) => json(page([produit(1), produit(2), produit(3), produit(4)], Number(url.searchParams.get('page')), 2, 16)),
  };
  for (const n of [1, 2, 3, 4]) {
    routes[`GET /api/v1/stock/${produit(n).id}`] = (_url, init) => {
      appels.push(String((init.headers as Record<string, string>).Authorization));
      const niveau = niveaux[produit(n).id];
      return niveau ? json({ productId: produit(n).id, ...niveau }) : json({ status: 404 }, 404);
    };
  }
  return simulerApi(routes);
}

describe('etatStock', () => {
  it('classe les niveaux de stock', () => {
    expect(etatStock(null)).toBe('non-suivi');
    expect(etatStock({ productId: 'p', available: 0, reserved: 1 })).toBe('epuise');
    expect(etatStock({ productId: 'p', available: 5, reserved: 0 })).toBe('bas');
    expect(etatStock({ productId: 'p', available: 6, reserved: 0 })).toBe('correct');
  });
});

describe('Espace administrateur : stock', () => {
  it('montre le lien « Stock » aux seuls administrateurs', () => {
    api();
    rendreApp('/', fausseAuth(ADMIN));
    const navigation = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(navigation).getByRole('link', { name: 'Stock' })).toHaveAttribute('href', '/admin/stock');
    expect(within(navigation).queryByRole('link', { name: 'Mes commandes' })).not.toBeInTheDocument();
  });

  it('liste le stock de chaque produit avec le jeton administrateur', async () => {
    const appels: string[] = [];
    api(appels);
    rendreApp('/admin/stock', fausseAuth(ADMIN));
    const tableau = await screen.findByRole('table', { name: /Stock des produits du catalogue, page 1 sur 2/ });
    const ligne = (nom: string) => within(tableau).getByRole('rowheader', { name: nom }).closest('tr')!;
    expect(ligne('Produit 01')).toHaveTextContent(/PME-01\s*120\s*3\s*Correct/);
    expect(ligne('Produit 02')).toHaveTextContent('Stock bas');
    expect(ligne('Produit 03')).toHaveTextContent('Épuisé');
    expect(ligne('Produit 04')).toHaveTextContent(/–\s*–\s*Non suivi/);
    expect(screen.getByRole('status')).toHaveTextContent(/3 produits à surveiller sur cette page/);
    expect(appels).toEqual(Array(4).fill('Bearer jeton-de-test'));
    await vi.waitFor(() => expect(document.title).toBe("Stock – La Petite Maison de l'Épouvante"));
  });

  it('filtre les produits à surveiller et actualise à la demande', async () => {
    const fetch = api();
    const { utilisateur } = rendreApp('/admin/stock', fausseAuth(ADMIN));
    const tableau = await screen.findByRole('table');
    await utilisateur.click(screen.getByLabelText(/N'afficher que les produits à surveiller/));
    expect(within(tableau).queryByRole('rowheader', { name: 'Produit 01' })).not.toBeInTheDocument();
    expect(within(tableau).getAllByRole('rowheader')).toHaveLength(3);
    const avant = fetch.mock.calls.length;
    await utilisateur.click(screen.getByRole('button', { name: 'Actualiser' }));
    await vi.waitFor(() => expect(fetch.mock.calls.length).toBe(avant + 5));
    expect(within(tableau).getAllByRole('rowheader')).toHaveLength(3);
  });

  it('affiche une erreur avec la référence de corrélation', async () => {
    simulerApi({ 'GET /api/v1/products': () => json(page([produit(1)])), [`GET /api/v1/stock/${produit(1).id}`]: () => json({}, 500) });
    rendreApp('/admin/stock', fausseAuth(ADMIN));
    const alerte = await screen.findByRole('alert');
    expect(alerte).toHaveTextContent('Une erreur est survenue côté serveur.');
    expect(within(alerte).getByText(/^web-/)).toBeInTheDocument();
  });

  it('refuse un client et demande la connexion à un visiteur', async () => {
    api();
    rendreApp('/admin/stock', fausseAuth(CLIENT));
    expect(await screen.findByRole('heading', { level: 1, name: 'Accès refusé' })).toBeInTheDocument();
    expect(screen.getByText(/Cette page est réservée aux administrateurs de la boutique\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Changer de compte' })).toBeInTheDocument();
  });

  it('demande une connexion d’administration à un visiteur', async () => {
    api();
    rendreApp('/admin/stock');
    expect(await screen.findByText(/compte d'administration/)).toBeInTheDocument();
  });
});
