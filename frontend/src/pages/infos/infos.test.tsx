import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fausseAuth, json, page, produit, rendreApp, simulerApi } from '../../test/outils';

afterEach(() => vi.unstubAllGlobals());

function api() {
  simulerApi({
    'GET /api/v1/categories': () => json(['Blu-ray', 'Goodies']),
    'GET /api/v1/products': () => json(page([produit(1)])),
  });
}

describe('Pages d’information', () => {
  it('le pied de page donne accès aux pages légales et à l’état de conformité', () => {
    api();
    rendreApp('/');
    const pied = screen.getByRole('navigation', { name: 'Informations sur le site' });
    expect(within(pied).getByRole('link', { name: 'Accessibilité : non conforme' })).toHaveAttribute('href', '/accessibilite');
    expect(within(pied).getByRole('link', { name: 'Plan du site' })).toHaveAttribute('href', '/plan-du-site');
    expect(within(pied).getByRole('link', { name: 'Mentions légales' })).toBeInTheDocument();
    expect(within(pied).getByRole('link', { name: 'Données personnelles et cookies' })).toBeInTheDocument();
  });

  it('le plan du site liste les catégories et, pour un administrateur, le stock', async () => {
    api();
    rendreApp('/plan-du-site', fausseAuth({ connecte: true, utilisateur: 'admin-pme', roles: ['ADMIN'] }));
    const plan = await screen.findByRole('navigation', { name: 'Plan du site' });
    expect(await within(plan).findByRole('link', { name: 'Blu-ray' })).toHaveAttribute('href', '/?categorie=Blu-ray');
    expect(within(plan).getByRole('link', { name: 'Stock' })).toBeInTheDocument();
    await vi.waitFor(() => expect(document.title).toBe("Plan du site – La Petite Maison de l'Épouvante"));
  });

  it('la déclaration d’accessibilité indique l’état « non conforme » et les voies de recours', async () => {
    api();
    rendreApp('/accessibilite');
    expect(await screen.findByRole('heading', { level: 1, name: "Déclaration d'accessibilité" })).toBeInTheDocument();
    expect(screen.getByText('non conforme')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Voies de recours' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'formulaire en ligne' })).toHaveAttribute('href', 'https://formulaire.defenseurdesdroits.fr/');
  });

  it('les mentions légales signalent un démonstrateur', async () => {
    api();
    rendreApp('/mentions-legales');
    expect(await screen.findByText('démonstrateur')).toBeInTheDocument();
  });

  it('la page données personnelles décrit les traitements et les cookies', async () => {
    api();
    rendreApp('/donnees-personnelles');
    const tableau = await screen.findByRole('table', { name: 'Traitements de données personnelles' });
    expect(within(tableau).getAllByRole('row')).toHaveLength(5);
    expect(within(tableau).getByRole('rowheader', { name: /Espace communautaire/ })).toBeInTheDocument();
    expect(screen.getByText(/Aucun cookie de mesure d'audience/)).toBeInTheDocument();
  });

  it('place le focus sur le titre d’une page chargée à la demande', async () => {
    api();
    const { utilisateur } = rendreApp('/');
    await utilisateur.click(screen.getByRole('link', { name: 'Mentions légales' }));
    const titre = await screen.findByRole('heading', { level: 1, name: 'Mentions légales' });
    await vi.waitFor(() => expect(titre).toHaveFocus());
  });
});
