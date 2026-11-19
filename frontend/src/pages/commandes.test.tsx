import { act, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLIENT, commande, fausseAuth, json, page, rendreApp, simulerApi } from '../test/outils';
import { ESSAIS_SUIVI_MAX, INTERVALLE_SUIVI_MS } from './CommandePage';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const ID = commande().id;

describe('Suivi de commande', () => {
  it('interroge le service tant que la commande est en attente, puis annonce la confirmation', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let appels = 0;
    simulerApi({
      [`GET /api/v1/orders/${ID}`]: () => json(commande({ status: ++appels < 3 ? 'PENDING' : 'CONFIRMED' })),
    });
    rendreApp(`/commandes/${ID}`, fausseAuth(CLIENT));
    expect(await screen.findByText('En attente de confirmation')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Statut : En attente de confirmation');
    expect(screen.getByText(/se met à jour automatiquement/)).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(INTERVALLE_SUIVI_MS));
    await act(() => vi.advanceTimersByTimeAsync(INTERVALLE_SUIVI_MS));
    expect(await screen.findByText('Confirmée')).toBeInTheDocument();
    expect(screen.getByText('Le stock est réservé : votre commande sera préparée.')).toBeInTheDocument();
    expect(appels).toBe(3);
    const tableau = screen.getByRole('table', { name: 'Articles de la commande' });
    expect(within(tableau).getByRole('rowheader', { name: 'Mug' })).toBeInTheDocument();
  });

  it('cesse d’interroger après le nombre maximal d’essais et propose d’actualiser', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetch = simulerApi({ [`GET /api/v1/orders/${ID}`]: () => json(commande()) });
    const { utilisateur } = rendreApp(`/commandes/${ID}`, fausseAuth(CLIENT));
    await screen.findByText('En attente de confirmation');
    for (let i = 0; i < ESSAIS_SUIVI_MAX + 2; i++) {
      await act(() => vi.advanceTimersByTimeAsync(INTERVALLE_SUIVI_MS));
    }
    expect(await screen.findByText(/prend plus de temps que prévu/)).toBeInTheDocument();
    // Seuls les relevés de la commande comptent (l'en-tête relève aussi les notifications non lues).
    const releves = () => fetch.mock.calls.filter(([url]) => String(url).includes(`/api/v1/orders/${ID}`)).length;
    expect(releves()).toBe(ESSAIS_SUIVI_MAX + 1);
    await utilisateur.click(screen.getByRole('button', { name: 'Actualiser le statut' }));
    await vi.waitFor(() => expect(releves()).toBe(ESSAIS_SUIVI_MAX + 2));
  });

  it('explique une annulation', async () => {
    simulerApi({ [`GET /api/v1/orders/${ID}`]: () => json(commande({ status: 'CANCELLED' })) });
    rendreApp(`/commandes/${ID}`, fausseAuth(CLIENT));
    expect(await screen.findByText('Annulée')).toBeInTheDocument();
    expect(screen.getByText(/la commande a été annulée, rien ne vous sera facturé/)).toBeInTheDocument();
  });

  it('ne révèle pas la commande d’un autre client (404)', async () => {
    simulerApi({});
    rendreApp(`/commandes/${ID}`, fausseAuth(CLIENT));
    expect(await screen.findByText("Cette commande n'existe pas ou ne vous appartient pas.")).toBeInTheDocument();
  });

  it('signale une panne', async () => {
    simulerApi({ [`GET /api/v1/orders/${ID}`]: () => json({}, 503) });
    rendreApp(`/commandes/${ID}`, fausseAuth(CLIENT));
    expect(await screen.findByRole('alert')).toHaveTextContent('momentanément indisponible');
  });
});

describe('Historique', () => {
  it('liste les commandes dans un tableau avec lien vers le suivi', async () => {
    const autre = commande({ id: 'aaaabbbb-0000-4000-8000-000000000000', status: 'CANCELLED' });
    simulerApi({ 'GET /api/v1/orders': () => json(page([commande({ status: 'CONFIRMED' }), autre], 0, 2, 12)) });
    const { utilisateur } = rendreApp('/commandes', fausseAuth(CLIENT));
    const tableau = await screen.findByRole('table', { name: /Historique de mes commandes \(12 au total/ });
    expect(within(tableau).getAllByRole('row')).toHaveLength(3);
    expect(within(tableau).getByText('Confirmée')).toBeInTheDocument();
    expect(within(tableau).getByText('Annulée')).toBeInTheDocument();
    expect(within(tableau).getByRole('link', { name: 'Commande n° AAAABBBB' })).toHaveAttribute(
      'href',
      `/commandes/${autre.id}`,
    );
    const pagination = screen.getByRole('navigation', { name: "Pages de l'historique" });
    await utilisateur.click(within(pagination).getByRole('link', { name: 'Page suivante' }));
    expect(await screen.findByText('Page 2 sur 2')).toBeInTheDocument();
  });

  it('indique un historique vide', async () => {
    simulerApi({ 'GET /api/v1/orders': () => json(page([], 0, 0, 0)) });
    rendreApp('/commandes?page=0', fausseAuth(CLIENT));
    expect(await screen.findByText(/pas encore passé de commande/)).toBeInTheDocument();
  });

  it('propose de réessayer après une erreur', async () => {
    simulerApi({ 'GET /api/v1/orders': () => json({}, 429) });
    rendreApp('/commandes', fausseAuth(CLIENT));
    expect(await screen.findByRole('alert')).toHaveTextContent('Trop de demandes');
  });
});

describe('Accès aux pages de commandes', () => {
  it('attend la vérification de session', () => {
    simulerApi({});
    rendreApp('/commandes', fausseAuth({ pret: false }));
    expect(screen.getByRole('status')).toHaveTextContent('Vérification de la session…');
  });

  it('propose la connexion à un visiteur', async () => {
    simulerApi({});
    const auth = fausseAuth();
    const { utilisateur } = rendreApp('/commandes', auth);
    expect(screen.getByRole('heading', { level: 1, name: 'Connexion requise' })).toBeInTheDocument();
    await utilisateur.click(within(screen.getByRole('main')).getByRole('button', { name: 'Se connecter' }));
    expect(auth.connecter).toHaveBeenCalled();
  });

  it('refuse un compte sans rôle client et propose de changer de compte', async () => {
    simulerApi({});
    const auth = fausseAuth({ connecte: true, utilisateur: 'bob', roles: [] });
    const { utilisateur } = rendreApp('/commandes', auth);
    expect(screen.getByRole('heading', { level: 1, name: 'Accès refusé' })).toBeInTheDocument();
    const principal = within(screen.getByRole('main'));
    expect(principal.getByText(/Vous êtes connecté avec le compte « bob »/)).toBeInTheDocument();
    await utilisateur.click(principal.getByRole('button', { name: 'Changer de compte' }));
    expect(auth.changerDeCompte).toHaveBeenCalled();
  });
});
