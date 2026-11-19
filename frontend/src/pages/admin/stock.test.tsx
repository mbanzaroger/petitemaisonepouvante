import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { etatStock } from '../../api/stock';
import { CLIENT, corpsEnvoye, fausseAuth, json, page, produit, rendreApp, simulerApi } from '../../test/outils';

afterEach(() => vi.unstubAllGlobals());

const ADMIN = { connecte: true, utilisateur: 'admin-pme', roles: ['ADMIN'] };

function api(appels: string[] = []) {
  const niveaux: Record<string, { available: number; reserved: number } | undefined> = {
    [produit(1).id]: { available: 120, reserved: 3 },
    [produit(2).id]: { available: 2, reserved: 0 },
    [produit(3).id]: { available: 0, reserved: 10 },
  };
  const routes: Parameters<typeof simulerApi>[0] = {
    'GET /api/v1/catalog/admin/products': (url) =>
      json(
        page(
          [produit(1), produit(2), produit(3), produit(4, { available: false, exclusive: true })],
          Number(url.searchParams.get('page')),
          2,
          16,
        ),
      ),
    [`POST /api/v1/stock/${produit(2).id}/restock`]: () => json({ productId: produit(2).id, available: 27, reserved: 0 }),
    [`PUT /api/v1/catalog/admin/products/${produit(4).id}`]: () => json(produit(4, { available: true })),
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

describe('Espace administrateur : produits et stock (US18)', () => {
  it('montre les liens d’administration aux seuls administrateurs', () => {
    api();
    rendreApp('/', fausseAuth(ADMIN));
    const navigation = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(navigation).getByRole('link', { name: 'Produits et stock' })).toHaveAttribute('href', '/admin/stock');
    expect(within(navigation).getByRole('link', { name: 'Commandes clients' })).toHaveAttribute('href', '/admin/commandes');
    expect(within(navigation).queryByRole('link', { name: 'Mes commandes' })).not.toBeInTheDocument();
  });

  it('liste le stock de chaque produit avec le jeton administrateur', async () => {
    const appels: string[] = [];
    api(appels);
    rendreApp('/admin/stock', fausseAuth(ADMIN));
    const tableau = await screen.findByRole('table', { name: /Produits et stock, page 1 sur 2/ });
    const ligne = (nom: RegExp) => within(tableau).getByRole('rowheader', { name: nom }).closest('tr')!;
    expect(ligne(/^Produit 01/)).toHaveTextContent(/PME-01.*En vente\s*120\s*3\s*Correct/);
    expect(ligne(/^Produit 02/)).toHaveTextContent('Stock bas');
    expect(ligne(/^Produit 03/)).toHaveTextContent('Épuisé');
    expect(ligne(/^Produit 04/)).toHaveTextContent(/Exclusivité Evil Ed.*Retiré\s*–\s*–\s*Non suivi/);
    expect(screen.getByText(/3 produits à surveiller sur cette page/)).toBeInTheDocument();
    expect(appels).toEqual(Array(4).fill('Bearer jeton-de-test'));
    expect(screen.getByRole('link', { name: 'Ajouter un produit' })).toHaveAttribute('href', '/admin/produits/nouveau');
    await vi.waitFor(() => expect(document.title).toBe("Produits et stock – La Petite Maison de l'Épouvante"));
  });

  it('filtre les produits à surveiller et actualise à la demande', async () => {
    const fetch = api();
    const { utilisateur } = rendreApp('/admin/stock', fausseAuth(ADMIN));
    const tableau = await screen.findByRole('table');
    await utilisateur.click(screen.getByLabelText(/N'afficher que les produits à surveiller/));
    expect(within(tableau).queryByRole('rowheader', { name: /^Produit 01/ })).not.toBeInTheDocument();
    expect(within(tableau).getAllByRole('rowheader')).toHaveLength(3);
    const avant = fetch.mock.calls.length;
    await utilisateur.click(screen.getByRole('button', { name: 'Actualiser' }));
    await vi.waitFor(() => expect(fetch.mock.calls.length).toBe(avant + 5));
    expect(within(tableau).getAllByRole('rowheader')).toHaveLength(3);
  });

  it('réapprovisionne un produit et remet en vente un produit retiré', async () => {
    const fetch = api();
    const { utilisateur } = rendreApp('/admin/stock', fausseAuth(ADMIN));
    await screen.findByRole('table');
    const quantite = screen.getByLabelText('Quantité à ajouter au stock de Produit 02');
    await utilisateur.clear(quantite);
    await utilisateur.type(quantite, '25');
    await utilisateur.click(screen.getByRole('button', { name: 'Ajouter au stock de Produit 02' }));
    expect(await screen.findByText('Stock de « Produit 02 » : 27 disponibles.')).toBeInTheDocument();
    expect(corpsEnvoye(fetch, 'POST', `/api/v1/stock/${produit(2).id}/restock`)).toEqual({ quantity: 25 });

    await utilisateur.click(screen.getByRole('button', { name: 'Remettre en vente : Produit 04' }));
    expect(await screen.findByText('« Produit 04 » est de nouveau en vente.')).toBeInTheDocument();
    expect(corpsEnvoye(fetch, 'PUT', `/api/v1/catalog/admin/products/${produit(4).id}`)).toMatchObject({
      active: true,
      exclusive: true,
      category: produit(4).category,
      priceCents: produit(4).price.amountCents,
    });
  });

  it('affiche une erreur avec la référence de corrélation', async () => {
    simulerApi({
      'GET /api/v1/catalog/admin/products': () => json(page([produit(1)])),
      [`GET /api/v1/stock/${produit(1).id}`]: () => json({}, 500),
    });
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
