import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { json, page, produit, rendreApp, simulerApi } from '../test/outils';

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => localStorage.clear());

const RAYONS = ['Blu-ray', 'Figurines', 'Goodies'];
const AVEC_IMAGE = produit(1, { imageUrl: `/api/v1/products/${produit(1).id}/image?v=0123456789abcdef` });

function api() {
  return simulerApi({
    'GET /api/v1/categories': () => json(RAYONS),
    'GET /api/v1/products': (url) =>
      json(page(url.searchParams.get('q') === 'orc' ? [produit(5, { name: "Buste de L'Orc" })] : [AVEC_IMAGE, produit(2)])),
  });
}

describe('En-tête de la boutique (refonte)', () => {
  it('cherche un produit dans un rayon depuis l’en-tête (US22)', async () => {
    const fetch = api();
    const { utilisateur } = rendreApp('/');
    const recherche = screen.getByRole('search', { name: 'Rechercher dans la boutique' });
    await utilisateur.selectOptions(await within(recherche).findByLabelText('Rayon'), 'Figurines');
    await utilisateur.type(within(recherche).getByLabelText('Rechercher un produit'), 'orc');
    await utilisateur.click(within(recherche).getByRole('button', { name: 'Lancer la recherche' }));
    expect(await screen.findByRole('link', { name: "Buste de L'Orc" })).toBeInTheDocument();
    expect(screen.getByText('1 produit dans la catégorie « Figurines » pour « orc »')).toBeInTheDocument();
    const appel = new URL(String(fetch.mock.calls.at(-1)?.[0]), 'http://localhost');
    expect(appel.searchParams.get('q')).toBe('orc');
    expect(appel.searchParams.get('category')).toBe('Figurines');
    await vi.waitFor(() => expect(document.title).toBe("Recherche : orc – La Petite Maison de l'Épouvante"));
  });

  it('déplie la liste des rayons et la referme avec Échap', async () => {
    api();
    const { utilisateur } = rendreApp('/');
    const bouton = screen.getByRole('button', { name: 'Toutes les catégories' });
    expect(bouton).toHaveAttribute('aria-expanded', 'false');
    await utilisateur.click(bouton);
    expect(bouton).toHaveAttribute('aria-expanded', 'true');
    const menu = document.getElementById('menu-rayons')!;
    expect(await within(menu).findByRole('link', { name: 'Blu-ray' })).toHaveAttribute('href', '/?categorie=Blu-ray');
    expect(within(menu).getByRole('link', { name: 'Exclusivités Evil Ed' })).toHaveAttribute('href', '/?exclusif=1');
    await utilisateur.keyboard('{Escape}');
    expect(bouton).toHaveAttribute('aria-expanded', 'false');
    expect(bouton).toHaveFocus();
    expect(menu).not.toBeVisible();
  });

  it('garde les informations légales et les magasins dans le pied de page', () => {
    api();
    rendreApp('/');
    const pied = screen.getByRole('contentinfo');
    expect(within(pied).getByRole('navigation', { name: 'Informations sur le site' })).toBeInTheDocument();
    expect(within(pied).getByRole('link', { name: 'Accessibilité : non conforme' })).toHaveAttribute('href', '/accessibilite');
    expect(within(pied).getByText('Aix-en-Provence')).toBeInTheDocument();
    expect(within(pied).getByText(/aucun paiement réel/)).toBeInTheDocument();
  });
});

describe('Catalogue (refonte)', () => {
  it('affiche l’image de chaque produit, ou le pictogramme de son rayon', async () => {
    api();
    rendreApp('/');
    const carte = (await screen.findByRole('link', { name: 'Produit 01' })).closest('li')!;
    const image = carte.querySelector('img');
    expect(image).toHaveAttribute('src', AVEC_IMAGE.imageUrl);
    expect(image).toHaveAttribute('alt', '');
    expect(image).toHaveAttribute('width', '600');
    const sansImage = screen.getByRole('link', { name: 'Produit 02' }).closest('li')!;
    expect(sansImage.querySelector('img')).toBeNull();
    expect(sansImage.querySelector('.image-absente')).toHaveAttribute('aria-hidden', 'true');
  });

  it('trie par prix (US22) sans perdre les autres critères', async () => {
    const fetch = api();
    const { utilisateur } = rendreApp('/?categorie=Goodies');
    await screen.findByRole('link', { name: 'Produit 01' });
    await utilisateur.selectOptions(screen.getByLabelText('Trier par'), 'prix-decroissant');
    await vi.waitFor(() => {
      const appel = new URL(String(fetch.mock.calls.at(-1)?.[0]), 'http://localhost');
      expect(appel.searchParams.get('sort')).toBe('price-desc');
      expect(appel.searchParams.get('category')).toBe('Goodies');
    });
    expect(screen.getByLabelText('Trier par')).toHaveValue('prix-decroissant');
  });

  it('passe de la grille à la liste et retient le choix', async () => {
    api();
    const { utilisateur, unmount } = rendreApp('/');
    await screen.findByRole('link', { name: 'Produit 01' });
    const groupe = screen.getByRole('group', { name: 'Affichage des produits' });
    const liste = within(groupe).getByRole('button', { name: 'En liste' });
    expect(within(groupe).getByRole('button', { name: 'En grille' })).toHaveAttribute('aria-pressed', 'true');
    await utilisateur.click(liste);
    expect(liste).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('link', { name: 'Produit 01' }).closest('ul')).toHaveClass('vue-liste');
    unmount();
    rendreApp('/');
    await screen.findByRole('link', { name: 'Produit 01' });
    expect(screen.getByRole('button', { name: 'En liste' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('propose les rayons dans la colonne latérale avec le rayon courant signalé', async () => {
    api();
    rendreApp('/?categorie=Figurines');
    const rayons = screen.getByRole('navigation', { name: 'Rayons' });
    expect(await within(rayons).findByRole('link', { name: 'Figurines' })).toHaveAttribute('aria-current', 'page');
    expect(within(rayons).getByRole('link', { name: 'Tout le catalogue' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('navigation', { name: "Fil d'Ariane" })).toHaveTextContent('Figurines');
  });
});

describe('Fiche produit (refonte)', () => {
  it('montre le visuel du produit avec un texte de remplacement', async () => {
    simulerApi({ [`GET /api/v1/products/${produit(1).id}`]: () => json(AVEC_IMAGE) });
    rendreApp(`/produits/${produit(1).id}`);
    expect(await screen.findByRole('img', { name: 'Visuel du produit : Produit 01' })).toHaveAttribute(
      'src',
      AVEC_IMAGE.imageUrl,
    );
    expect(screen.getByRole('navigation', { name: "Fil d'Ariane" })).toHaveTextContent(/Catalogue.*Goodies.*Produit 01/);
  });
});
