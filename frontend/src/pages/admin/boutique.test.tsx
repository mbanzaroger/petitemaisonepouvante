import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { centimesDepuisSaisie } from '../../api/admin';
import { CLIENT, commande, corpsEnvoye, fausseAuth, json, page, produit, rendreApp, simulerApi } from '../../test/outils';

afterEach(() => vi.unstubAllGlobals());

const ADMIN = { connecte: true, utilisateur: 'admin-pme', roles: ['ADMIN'] };
const CATEGORIES = ['Figurines', 'Goodies'];

describe('centimesDepuisSaisie', () => {
  it('convertit un prix saisi en euros', () => {
    expect(centimesDepuisSaisie('24,90')).toBe(2490);
    expect(centimesDepuisSaisie(' 12.5 ')).toBe(1250);
    expect(centimesDepuisSaisie('7')).toBe(700);
    expect(centimesDepuisSaisie('0')).toBeNull();
    expect(centimesDepuisSaisie('12,999')).toBeNull();
    expect(centimesDepuisSaisie('abc')).toBeNull();
  });
});

describe('Nouveau produit (US18)', () => {
  async function remplir(utilisateur: ReturnType<typeof rendreApp>['utilisateur'], prix = '45,90', stock = '12') {
    await utilisateur.type(await screen.findByLabelText(/^Nom/), 'Figurine Evil Ed « Le Lustre »');
    await utilisateur.type(screen.getByLabelText(/^Référence unique/), 'fig-evl-042');
    await utilisateur.selectOptions(screen.getByLabelText('Catégorie'), 'Figurines');
    await utilisateur.type(screen.getByLabelText(/^Prix en euros/), prix);
    await utilisateur.type(screen.getByLabelText(/^Description/), 'Résine, 18 cm.');
    const quantite = screen.getByLabelText(/^Stock initial/);
    await utilisateur.clear(quantite);
    await utilisateur.type(quantite, stock);
    await utilisateur.click(screen.getByLabelText(/^Exclusivité Evil Ed/));
  }

  it('crée le produit puis son stock initial', async () => {
    const cree = produit(9, { name: 'Figurine Evil Ed « Le Lustre »', price: { amountCents: 4590, currency: 'EUR' } });
    const fetch = simulerApi({
      'GET /api/v1/categories': () => json(CATEGORIES),
      'POST /api/v1/catalog/admin/products': () => json(cree, 201),
      [`POST /api/v1/stock/${cree.id}/restock`]: () => json({ productId: cree.id, available: 12, reserved: 0 }),
    });
    const { utilisateur } = rendreApp('/admin/produits/nouveau', fausseAuth(ADMIN));
    await remplir(utilisateur);
    await utilisateur.click(screen.getByRole('button', { name: 'Créer le produit' }));

    const statut = await screen.findByText(/Produit créé et mis en vente/);
    expect(statut).toHaveTextContent(/Stock initial : 12 unités\./);
    expect(within(statut).getByRole('link', { name: 'Figurine Evil Ed « Le Lustre »' })).toHaveAttribute(
      'href',
      `/produits/${cree.id}`,
    );
    expect(corpsEnvoye(fetch, 'POST', '/api/v1/catalog/admin/products')).toEqual({
      sku: 'FIG-EVL-042',
      name: 'Figurine Evil Ed « Le Lustre »',
      description: 'Résine, 18 cm.',
      priceCents: 4590,
      category: 'Figurines',
      exclusive: true,
    });
    expect(corpsEnvoye(fetch, 'POST', `/api/v1/stock/${cree.id}/restock`)).toEqual({ quantity: 12 });
  });

  it('refuse un prix invalide et signale un stock non enregistré', async () => {
    const cree = produit(9);
    const fetch = simulerApi({
      'GET /api/v1/categories': () => json(CATEGORIES),
      'POST /api/v1/catalog/admin/products': () => json(cree, 201),
      [`POST /api/v1/stock/${cree.id}/restock`]: () => json({ title: 'Erreur' }, 503),
    });
    const { utilisateur } = rendreApp('/admin/produits/nouveau', fausseAuth(ADMIN));
    await remplir(utilisateur, '12,999');
    await utilisateur.click(screen.getByRole('button', { name: 'Créer le produit' }));
    expect(screen.getByLabelText(/^Prix en euros/)).toBeInvalid();
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);

    const prix = screen.getByLabelText(/^Prix en euros/);
    await utilisateur.clear(prix);
    await utilisateur.type(prix, '12,90');
    await utilisateur.click(screen.getByRole('button', { name: 'Créer le produit' }));
    expect(await screen.findByText(/Produit créé, mais le stock initial n'a pas été enregistré/)).toBeInTheDocument();
  });

  it('affiche le refus du service (référence déjà utilisée)', async () => {
    simulerApi({
      'GET /api/v1/categories': () => json(CATEGORIES),
      'POST /api/v1/catalog/admin/products': () =>
        json({ title: 'Conflict', status: 409, detail: 'La référence FIG-EVL-042 existe déjà.' }, 409),
    });
    const { utilisateur } = rendreApp('/admin/produits/nouveau', fausseAuth(ADMIN));
    await remplir(utilisateur);
    await utilisateur.click(screen.getByRole('button', { name: 'Créer le produit' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(/Produit créé/)).not.toBeInTheDocument();
  });
});

describe('Commandes clients (US19)', () => {
  const confirmee = { ...commande({ status: 'CONFIRMED' }), customerName: 'alice' };
  const ancienne = { ...commande({ id: 'b1b2c3d4-0000-4000-8000-000000000002', status: 'CANCELLED' }), customerName: null };

  it('liste les commandes de tous les clients, avec la synthèse, et filtre par statut', async () => {
    const fetch = simulerApi({
      'GET /api/v1/orders/admin/summary': () =>
        json({ countsByStatus: { PENDING: 1, CONFIRMED: 4, CANCELLED: 2 }, confirmedRevenueCents: 23960, currency: 'EUR' }),
      'GET /api/v1/orders/admin': (url) =>
        json(page(url.searchParams.get('status') === 'CONFIRMED' ? [confirmee] : [confirmee, ancienne])),
    });
    const { utilisateur } = rendreApp('/admin/commandes', fausseAuth(ADMIN));
    const synthese = await screen.findByRole('list', { name: 'Synthèse des commandes' });
    expect(synthese).toHaveTextContent(/4 confirmée/);
    expect(synthese).toHaveTextContent(/239,60\s€ de commandes confirmées/);
    const tableau = await screen.findByRole('table', { name: /Commandes de tous les clients/ });
    expect(within(tableau).getAllByRole('row')).toHaveLength(3);
    expect(within(tableau).getByText('alice')).toBeInTheDocument();
    expect(within(tableau).getByText('Non renseigné')).toBeInTheDocument();
    expect(within(tableau).getAllByText(/\d+ × /).length).toBeGreaterThan(0);

    await utilisateur.selectOptions(screen.getByLabelText('Statut'), 'CONFIRMED');
    expect(await screen.findByRole('table', { name: /Commandes « confirmée »/ })).toBeInTheDocument();
    expect(fetch.mock.calls.some(([u]) => String(u).includes('status=CONFIRMED'))).toBe(true);
  });

  it('indique l’absence de commande et refuse un client', async () => {
    simulerApi({
      'GET /api/v1/orders/admin/summary': () =>
        json({ countsByStatus: { PENDING: 0, CONFIRMED: 0, CANCELLED: 0 }, confirmedRevenueCents: 0, currency: 'EUR' }),
      'GET /api/v1/orders/admin': () => json(page([])),
    });
    const { unmount } = rendreApp('/admin/commandes', fausseAuth(ADMIN));
    expect(await screen.findByText('Aucune commande à afficher.')).toBeInTheDocument();
    unmount();
    rendreApp('/admin/commandes', fausseAuth(CLIENT));
    expect(await screen.findByRole('heading', { level: 1, name: 'Accès refusé' })).toBeInTheDocument();
  });
});

describe('Inscription d’un nouveau client (US20)', () => {
  it('propose de créer un compte dans l’en-tête, sur une page réservée et au panier', async () => {
    simulerApi({ 'GET /api/v1/products': () => json(page([])), 'GET /api/v1/categories': () => json([]) });
    const visiteur = fausseAuth();
    const { utilisateur, unmount } = rendreApp('/commandes', visiteur);
    await utilisateur.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Créer un compte' }));
    await utilisateur.click(within(screen.getByRole('main')).getByRole('button', { name: 'Créer un compte client' }));
    expect(visiteur.inscrire).toHaveBeenCalledTimes(2);
    unmount();
    rendreApp('/admin/stock', fausseAuth());
    expect(within(screen.getByRole('main')).queryByRole('button', { name: /Créer un compte/ })).not.toBeInTheDocument();
  });
});
