import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLIENT, annonce, corpsEnvoye, fausseAuth, json, rendreApp, simulerApi } from '../test/outils';

afterEach(() => vi.unstubAllGlobals());

const API = '/api/v1/community';

function api(surcharge: Record<string, Parameters<typeof simulerApi>[0][string]> = {}) {
  let lues = false;
  return simulerApi({
    [`GET ${API}/notifications`]: () =>
      json([
        {
          id: 2,
          type: 'NEW_OFFER',
          text: 'carol vous propose un échange pour « Annonce 01 ».',
          link: '/communaute/propositions/p1',
          read: lues,
          createdAt: '2026-11-16T10:00:00Z',
        },
        { id: 1, type: 'WISH_MATCH', text: 'Ancienne', link: '/communaute', read: true, createdAt: '2026-11-15T10:00:00Z' },
      ]),
    [`GET ${API}/notifications/unread-count`]: () => json({ unread: lues ? 0 : 1 }),
    [`POST ${API}/notifications/read`]: () => {
      lues = true;
      return new Response(null, { status: 204 });
    },
    [`GET ${API}/preferences`]: () => json({ offers: true, messages: true, wishes: false, browsing: false }),
    [`PUT ${API}/preferences`]: (_url, init) => json(JSON.parse(String(init.body))),
    [`GET ${API}/wishes`]: () => json([{ id: 'w1', keywords: 'Evil Ed', createdAt: '2026-11-16T10:00:00Z' }]),
    [`POST ${API}/wishes`]: () => json({ id: 'w2', keywords: 'Suspiria', createdAt: '2026-11-16T10:00:00Z' }, 201),
    [`DELETE ${API}/wishes/w1`]: () => new Response(null, { status: 204 }),
    [`GET ${API}/listings/mine`]: () => json([annonce(1, { mine: true, status: 'CONCLUDED' })]),
    'GET /api/v1/interests/preferences': () => json({ personalized: false }),
    ...surcharge,
  });
}

describe('Mon espace', () => {
  it('affiche le compte et les notifications, et les marque comme lues', async () => {
    api();
    const { utilisateur } = rendreApp('/mon-espace', fausseAuth(CLIENT));
    expect(await screen.findByRole('heading', { level: 1, name: 'Mon espace' })).toBeInTheDocument();
    expect(screen.getByText(/profil : client/)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'carol vous propose un échange pour « Annonce 01 ».' })).toHaveAttribute(
      'href',
      '/communaute/propositions/p1',
    );
    expect(screen.getByText('1 notification non lue.')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Mon espace.*1 notification non lue/ })).toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: 'Tout marquer comme lu' }));
    expect(await screen.findByText('Toutes vos notifications sont lues.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Annonce 01' })).toHaveAttribute('href', `/communaute/annonces/${annonce(1).id}`);
    expect(screen.getByText(/conclue/)).toBeInTheDocument();
  });

  it('enregistre les préférences de notification', async () => {
    const fetch = api();
    const { utilisateur } = rendreApp('/mon-espace', fausseAuth(CLIENT));
    const recherches = await screen.findByLabelText('Nouvelles annonces correspondant à mes recherches');
    expect(recherches).not.toBeChecked();
    await utilisateur.click(screen.getByLabelText('Nouveaux messages dans mes conversations'));
    await utilisateur.click(recherches);
    await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer les préférences' }));
    expect(await screen.findByText('Préférences enregistrées.')).toBeInTheDocument();
    await utilisateur.click(screen.getByLabelText(/catégories que je consulte souvent/));
    await utilisateur.click(screen.getByRole('button', { name: 'Enregistrer les préférences' }));
    await vi.waitFor(() =>
      expect(corpsEnvoye(fetch, 'PUT', `${API}/preferences`)).toEqual({
        offers: true,
        messages: false,
        wishes: true,
        browsing: true,
      }),
    );
  });

  it('ajoute et supprime des objets recherchés, et affiche les refus du service', async () => {
    const fetch = api();
    const { utilisateur } = rendreApp('/mon-espace', fausseAuth(CLIENT));
    const section = (await screen.findByRole('heading', { level: 2, name: 'Objets recherchés' })).closest('section')!;
    await utilisateur.type(within(section).getByLabelText('Objet recherché'), 'Suspiria');
    await utilisateur.click(within(section).getByRole('button', { name: 'Ajouter' }));
    expect(await within(section).findByText('Recherche « Suspiria » ajoutée.')).toBeInTheDocument();
    expect(corpsEnvoye(fetch, 'POST', `${API}/wishes`)).toEqual({ keywords: 'Suspiria' });
    await utilisateur.click(within(section).getByRole('button', { name: 'Supprimer la recherche « Evil Ed »' }));
    expect(await within(section).findByText('Recherche « Evil Ed » supprimée.')).toBeInTheDocument();
  });

  it('affiche le refus de doublon renvoyé par le service', async () => {
    api({
      [`POST ${API}/wishes`]: () => json({ status: 409, detail: 'Cette recherche est déjà dans votre liste.' }, 409),
    });
    const { utilisateur } = rendreApp('/mon-espace', fausseAuth(CLIENT));
    await utilisateur.type(await screen.findByLabelText('Objet recherché'), 'Evil Ed');
    await utilisateur.click(screen.getByRole('button', { name: 'Ajouter' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cette recherche est déjà dans votre liste.');
  });
});
