import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Le titre du document est posé par un effet (useTitre) : il est attendu, pas lu immédiatement.
const titreAttendu = (titre: string) => vi.waitFor(() => expect(document.title).toBe(titre));
import { json, page, produit, rendreApp, simulerApi } from '../test/outils';

afterEach(() => vi.unstubAllGlobals());

const CATEGORIES = ['Blu-ray', 'Goodies'];

describe('Catalogue', () => {
  it('liste les produits avec prix et disponibilité, et titre la page', async () => {
    simulerApi({
      'GET /api/v1/categories': () => json(CATEGORIES),
      'GET /api/v1/products': () => json(page([produit(1), produit(2, { available: false })], 0, 1, 2)),
    });
    rendreApp('/');
    expect(screen.getByRole('heading', { level: 1, name: 'Catalogue' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Produit 01' })).toHaveAttribute(
      'href',
      `/produits/${produit(1).id}`,
    );
    expect(screen.getByText('2 produits')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ajouter « Produit 02 » au panier' })).toBeDisabled();
    expect(screen.getByText('Indisponible')).toBeInTheDocument();
    await titreAttendu("Catalogue – La Petite Maison de l'Épouvante");
  });

  it('filtre par catégorie via un bouton explicite (pas de changement de contexte au choix)', async () => {
    const fetch = simulerApi({
      'GET /api/v1/categories': () => json(CATEGORIES),
      'GET /api/v1/products': (url) =>
        json(page(url.searchParams.get('category') === 'Blu-ray' ? [produit(3, { category: 'Blu-ray' })] : [produit(1)])),
    });
    const { utilisateur } = rendreApp('/');
    await screen.findByRole('link', { name: 'Produit 01' });
    await utilisateur.selectOptions(await screen.findByLabelText('Catégorie'), 'Blu-ray');
    expect(screen.getByRole('link', { name: 'Produit 01' })).toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: 'Filtrer' }));
    expect(await screen.findByRole('link', { name: 'Produit 03' })).toBeInTheDocument();
    expect(screen.getByText('1 produit dans la catégorie « Blu-ray »')).toBeInTheDocument();
    expect(fetch.mock.calls.some(([url]) => String(url).includes('category=Blu-ray'))).toBe(true);
    await titreAttendu("Catalogue : Blu-ray – La Petite Maison de l'Épouvante");
    await utilisateur.selectOptions(screen.getByLabelText('Catégorie'), '');
    await utilisateur.click(screen.getByRole('button', { name: 'Filtrer' }));
    expect(await screen.findByRole('link', { name: 'Produit 01' })).toBeInTheDocument();
  });

  it('ajoute au panier et annonce l’ajout dans une zone de statut', async () => {
    simulerApi({
      'GET /api/v1/categories': () => json(CATEGORIES),
      'GET /api/v1/products': () => json(page([produit(1)])),
    });
    const { utilisateur } = rendreApp('/');
    await utilisateur.click(await screen.findByRole('button', { name: 'Ajouter « Produit 01 » au panier' }));
    expect(screen.getByText('« Produit 01 » a été ajouté au panier.')).toBeInTheDocument();
    // Le panier est dans l'en-tête, à côté du compte (comme sur les boutiques en ligne).
    expect(within(screen.getByRole('banner')).getByRole('link', { name: /Panier.*\(1 article\)/ })).toBeInTheDocument();
  });

  it('pagine avec des liens explicites', async () => {
    const fetch = simulerApi({
      'GET /api/v1/categories': () => json(CATEGORIES),
      'GET /api/v1/products': (url) => {
        const numero = Number(url.searchParams.get('page'));
        return json(page([produit(numero + 1)], numero, 2, 13));
      },
    });
    const { utilisateur } = rendreApp('/?page=abc');
    const pagination = await screen.findByRole('navigation', { name: 'Pages du catalogue' });
    expect(within(pagination).getByText('Page 1 sur 2')).toBeInTheDocument();
    expect(within(pagination).getByText('Page précédente').tagName).toBe('SPAN');
    await utilisateur.click(within(pagination).getByRole('link', { name: 'Page suivante' }));
    expect(await screen.findByRole('link', { name: 'Produit 02' })).toBeInTheDocument();
    expect(within(screen.getByRole('navigation', { name: 'Pages du catalogue' })).getByText('Page 2 sur 2')).toBeInTheDocument();
    expect(String(fetch.mock.calls.at(-1)?.[0])).toContain('page=1');
  });

  it('affiche une erreur et permet de réessayer', async () => {
    let appels = 0;
    simulerApi({
      'GET /api/v1/categories': () => json(CATEGORIES),
      'GET /api/v1/products': () => (++appels === 1 ? json({}, 503) : json(page([], 0, 0, 0))),
    });
    const { utilisateur } = rendreApp('/');
    const alerte = await screen.findByRole('alert');
    expect(alerte).toHaveTextContent('momentanément indisponible');
    await utilisateur.click(within(alerte).getByRole('button', { name: 'Réessayer' }));
    expect(await screen.findByText('Aucun produit')).toBeInTheDocument();
  });
});

describe('Fiche produit', () => {
  it('affiche le détail et ajoute la quantité choisie', async () => {
    simulerApi({ [`GET /api/v1/products/${produit(4).id}`]: () => json(produit(4)) });
    const { utilisateur } = rendreApp(`/produits/${produit(4).id}`);
    expect(await screen.findByRole('heading', { level: 1, name: 'Produit 04' })).toBeInTheDocument();
    expect(screen.getByText('PME-04')).toBeInTheDocument();
    await utilisateur.selectOptions(screen.getByLabelText('Quantité'), '3');
    await utilisateur.click(screen.getByRole('button', { name: 'Ajouter au panier' }));
    expect(screen.getByRole('status')).toHaveTextContent('« Produit 04 » a été ajouté au panier.');
    await utilisateur.click(screen.getByRole('link', { name: 'Voir le panier' }));
    expect(await screen.findByLabelText('Quantité pour « Produit 04 »')).toHaveValue('3');
  });

  it('indique un produit introuvable', async () => {
    simulerApi({});
    rendreApp('/produits/inconnu');
    expect(await screen.findByRole('heading', { level: 1, name: 'Produit introuvable' })).toBeInTheDocument();
    await titreAttendu("Produit introuvable – La Petite Maison de l'Épouvante");
  });

  it('propose de réessayer en cas de panne', async () => {
    simulerApi({ [`GET /api/v1/products/${produit(4).id}`]: () => json({}, 500) });
    rendreApp(`/produits/${produit(4).id}`);
    expect(await screen.findByRole('alert')).toHaveTextContent('Une erreur est survenue côté serveur.');
  });

  it('ne propose pas l’ajout d’un produit indisponible', async () => {
    simulerApi({ [`GET /api/v1/products/${produit(5).id}`]: () => json(produit(5, { available: false })) });
    rendreApp(`/produits/${produit(5).id}`);
    expect(await screen.findByText('Indisponible')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ajouter au panier' })).not.toBeInTheDocument();
  });
});
