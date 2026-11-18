import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { stockerPanier, ajouterAuPanier } from '../cart/panier';
import { CLIENT, commande, corpsEnvoye, fausseAuth, json, page, produit, rendreApp, simulerApi } from '../test/outils';

afterEach(() => vi.unstubAllGlobals());

const RECOS = (personalized: boolean) => ({
  personalized,
  items: [
    { product: produit(1, { exclusive: true, name: 'Figurine Evil Ed' }), reason: 'Exclusivité Evil Ed, uniquement sur le site' },
    { product: produit(4), reason: 'Parce que vous vous intéressez à la catégorie « Goodies »' },
  ],
});

function appelsInteret(fetch: ReturnType<typeof simulerApi>) {
  return fetch.mock.calls
    .filter(([url, init]) => String(url).endsWith('/api/v1/interests') && init?.method === 'POST')
    .map(([, init]) => JSON.parse(String(init!.body)) as unknown);
}

describe('Exclusivités Evil Ed et recommandations', () => {
  it('filtre la gamme exclusive et la signale sur les cartes ; sélection commune pour un visiteur', async () => {
    const fetch = simulerApi({
      'GET /api/v1/categories': () => json(['Figurines']),
      'GET /api/v1/products': () => json(page([produit(1, { exclusive: true })])),
      'GET /api/v1/recommendations': () => json(RECOS(false)),
    });
    const { utilisateur } = rendreApp('/');
    const section = await screen.findByRole('region', { name: 'Exclusivités et sélection de la boutique' });
    // Badge sur la carte du catalogue et sur la recommandation
    expect(await screen.findAllByText('Exclusivité Evil Ed')).toHaveLength(2);
    expect(within(section).getByRole('link', { name: 'Figurine Evil Ed' })).toBeInTheDocument();
    expect(within(section).getByText('Exclusivité Evil Ed, uniquement sur le site')).toBeInTheDocument();
    await utilisateur.click(screen.getByLabelText('Exclusivités Evil Ed'));
    await utilisateur.click(screen.getByRole('button', { name: 'Filtrer' }));
    expect(await screen.findByText(/de la gamme exclusive Evil Ed/)).toBeInTheDocument();
    const url = fetch.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('/api/v1/products')).at(-1)!;
    expect(url).toContain('exclusive=true');
    expect(appelsInteret(fetch)).toEqual([]);
  });

  it('envoie la recherche par catégorie d’un membre qui a activé la personnalisation', async () => {
    const fetch = simulerApi({
      'GET /api/v1/categories': () => json(['Goodies']),
      'GET /api/v1/products': () => json(page([produit(4)])),
      'GET /api/v1/recommendations': () => json(RECOS(true)),
      'POST /api/v1/interests': () => new Response(null, { status: 202 }),
    });
    rendreApp('/?categorie=Goodies', fausseAuth(CLIENT));
    expect(await screen.findByRole('region', { name: 'Recommandé pour vous' })).toBeInTheDocument();
    await vi.waitFor(() => expect(appelsInteret(fetch)).toEqual([{ kind: 'SEARCH', category: 'Goodies' }]));
  });

  it('envoie la consultation d’une fiche seulement avec la personnalisation, et propose de l’activer sinon', async () => {
    const fetch = simulerApi({
      [`GET /api/v1/products/${produit(4).id}`]: () => json(produit(4)),
      'GET /api/v1/recommendations': () => json(RECOS(false)),
    });
    rendreApp(`/produits/${produit(4).id}`, fausseAuth(CLIENT));
    const section = await screen.findByRole('region', { name: 'Vous aimerez aussi' });
    expect(within(section).getByRole('link', { name: 'Mon espace' })).toHaveAttribute('href', '/mon-espace');
    expect(appelsInteret(fetch)).toEqual([]);
    const reco = fetch.mock.calls.map(([u]) => String(u)).find((u) => u.includes('/recommendations'))!;
    expect(reco).toContain(`exclude=${produit(4).id}`);
  });

  it('envoie la consultation d’une fiche quand la personnalisation est active', async () => {
    const fetch = simulerApi({
      [`GET /api/v1/products/${produit(1).id}`]: () => json(produit(1, { exclusive: true })),
      'GET /api/v1/recommendations': () => json(RECOS(true)),
      'POST /api/v1/interests': () => new Response(null, { status: 202 }),
    });
    rendreApp(`/produits/${produit(1).id}`, fausseAuth(CLIENT));
    expect(await screen.findByText('Exclusivité Evil Ed, uniquement sur le site', { selector: 'article .etiquette' })).toBeInTheDocument();
    await vi.waitFor(() => expect(appelsInteret(fetch)).toEqual([{ kind: 'VIEW', productId: produit(1).id }]));
  });

  it('transmet les achats après une commande si le membre a consenti', async () => {
    stockerPanier(ajouterAuPanier([], produit(8), 2).lignes);
    const fetch = simulerApi({
      'POST /api/v1/orders': () => json(commande(), 202),
      [`GET /api/v1/orders/${commande().id}`]: () => json(commande()),
      'GET /api/v1/interests/preferences': () => json({ personalized: true }),
      'POST /api/v1/interests': () => new Response(null, { status: 202 }),
    });
    const { utilisateur } = rendreApp('/panier', fausseAuth(CLIENT));
    await utilisateur.click(await screen.findByRole('button', { name: 'Valider la commande' }));
    await vi.waitFor(() => expect(appelsInteret(fetch)).toEqual([{ kind: 'PURCHASE', productId: produit(8).id }]));
  });

  it('règle la personnalisation et efface l’historique depuis Mon espace', async () => {
    const fetch = simulerApi({
      'GET /api/v1/interests/preferences': () => json({ personalized: false }),
      'PUT /api/v1/interests/preferences': (_url, init) => json(JSON.parse(String(init.body))),
      'DELETE /api/v1/interests': () => new Response(null, { status: 204 }),
    });
    const { utilisateur } = rendreApp('/mon-espace', fausseAuth(CLIENT));
    const section = (await screen.findByRole('heading', { level: 2, name: 'Recommandations' })).closest('section')!;
    const case_ = await within(section).findByLabelText(/Personnaliser les recommandations/);
    expect(case_).not.toBeChecked();
    await utilisateur.click(case_);
    await utilisateur.click(within(section).getByRole('button', { name: 'Enregistrer mon choix' }));
    expect(await within(section).findByText('Recommandations personnalisées activées.')).toBeInTheDocument();
    expect(corpsEnvoye(fetch, 'PUT', '/api/v1/interests/preferences')).toEqual({ personalized: true });
    await utilisateur.click(within(section).getByRole('button', { name: 'Effacer mon historique' }));
    expect(await within(section).findByText('Historique de navigation effacé.')).toBeInTheDocument();
  });
});
