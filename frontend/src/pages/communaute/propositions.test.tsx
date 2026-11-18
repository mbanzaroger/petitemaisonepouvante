import { act, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLIENT,
  corpsEnvoye,
  fausseAuth,
  json,
  message,
  proposition,
  rendreApp,
  simulerApi,
} from '../../test/outils';
import { INTERVALLE_PROPOSITION_MS, INTERVALLE_STATUT_MS } from './PropositionPage';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const API = '/api/v1/community';
const recue = proposition();

describe('Mes propositions', () => {
  it('liste les propositions reçues et envoyées', async () => {
    simulerApi({
      [`GET ${API}/offers`]: () =>
        json({
          received: [recue],
          sent: [proposition({ id: '0ffe0002-0000-4000-8000-000000000002', sent: true, status: 'ACCEPTED', listingTitle: 'Mug' })],
        }),
    });
    rendreApp('/communaute/propositions', fausseAuth(CLIENT));
    const recues = await screen.findByRole('table', { name: 'Propositions reçues' });
    expect(within(recues).getByRole('rowheader', { name: 'Annonce 01' })).toBeInTheDocument();
    expect(within(recues).getByText('carol')).toBeInTheDocument();
    expect(within(recues).getByText('En attente de réponse')).toBeInTheDocument();
    const envoyees = screen.getByRole('table', { name: 'Propositions envoyées' });
    expect(within(envoyees).getByText('alice')).toBeInTheDocument();
    expect(within(envoyees).getByText('Acceptée')).toBeInTheDocument();
  });

  it('indique les listes vides', async () => {
    simulerApi({ [`GET ${API}/offers`]: () => json({ received: [], sent: [] }) });
    rendreApp('/communaute/propositions', fausseAuth(CLIENT));
    expect(await screen.findByText('Aucune proposition reçue sur vos annonces.')).toBeInTheDocument();
    expect(screen.getByText("Vous n'avez fait aucune proposition.")).toBeInTheDocument();
  });
});

describe("Proposition reçue", () => {
  it("est acceptée par l'auteur de l'annonce, puis la conversation continue", async () => {
    const fetch = simulerApi({
      [`GET ${API}/offers/${recue.id}`]: () => json(recue),
      [`POST ${API}/offers/${recue.id}/acceptance`]: () => json({ ...recue, status: 'ACCEPTED', listingStatus: 'CONCLUDED' }),
      [`GET ${API}/offers/${recue.id}/messages`]: () => json([message(1, { content: 'Je propose une affiche.' })]),
      [`POST ${API}/offers/${recue.id}/messages`]: () => json(message(2, { content: 'Samedi ?', mine: true, author: 'alice' }), 201),
    });
    const { utilisateur } = rendreApp(`/communaute/propositions/${recue.id}`, fausseAuth(CLIENT));
    expect(await screen.findByRole('heading', { level: 2, name: 'Conversation avec carol' })).toBeInTheDocument();
    const fil = await screen.findByRole('log', { name: 'Messages : conversation avec carol' });
    expect(await within(fil).findByText('Je propose une affiche.')).toBeInTheDocument();

    await utilisateur.click(screen.getByRole('button', { name: 'Accepter la proposition' }));
    expect(await screen.findByText(/Proposition acceptée : l'annonce est conclue/)).toBeInTheDocument();
    expect(screen.getByText('Acceptée')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Décliner' })).not.toBeInTheDocument();

    await utilisateur.type(screen.getByLabelText('Votre message'), 'Samedi ?');
    await utilisateur.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await within(fil).findByText('Samedi ?')).toBeInTheDocument();
    expect(within(fil).getByText('Vous')).toBeInTheDocument();
    expect(screen.getByLabelText('Votre message')).toHaveValue('');
    expect(corpsEnvoye(fetch, 'POST', `${API}/offers/${recue.id}/messages`)).toEqual({ content: 'Samedi ?' });
  });

  it('affiche le conflit si la proposition a déjà été traitée', async () => {
    simulerApi({
      [`GET ${API}/offers/${recue.id}`]: () => json(recue),
      [`POST ${API}/offers/${recue.id}/decline`]: () =>
        json({ status: 409, detail: 'Cette proposition a déjà été traitée.' }, 409),
      [`GET ${API}/offers/${recue.id}/messages`]: () => json([]),
    });
    const { utilisateur } = rendreApp(`/communaute/propositions/${recue.id}`, fausseAuth(CLIENT));
    await utilisateur.click(await screen.findByRole('button', { name: 'Décliner' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Cette proposition a déjà été traitée.');
    expect(await screen.findByText('Aucun message pour le moment.')).toBeInTheDocument();
  });

  it('relève périodiquement les nouveaux messages après le dernier reçu', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetch = simulerApi({
      [`GET ${API}/offers/${recue.id}`]: () => json(recue),
      [`GET ${API}/offers/${recue.id}/messages`]: (url) =>
        json(url.searchParams.get('after') === '0' ? [message(7)] : [message(9, { content: 'Nouveau message' })]),
    });
    rendreApp(`/communaute/propositions/${recue.id}`, fausseAuth(CLIENT));
    expect(await screen.findByText('Message 7')).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(INTERVALLE_PROPOSITION_MS));
    expect(await screen.findByText('Nouveau message')).toBeInTheDocument();
    const releves = fetch.mock.calls.map(([url]) => new URL(String(url), 'http://localhost'));
    expect(releves.filter((url) => url.pathname.endsWith('/messages')).map((url) => url.searchParams.get('after'))).toEqual(
      expect.arrayContaining(['0', '7']),
    );
  });
});

describe('Proposition envoyée', () => {
  it("affiche l'acceptation décidée par l'autre membre sans recharger la page", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const envoyee = proposition({ sent: true });
    let acceptee = false;
    simulerApi({
      [`GET ${API}/offers/${envoyee.id}`]: () =>
        json(acceptee ? { ...envoyee, status: 'ACCEPTED', updatedAt: '2026-11-16T11:00:00Z' } : envoyee),
      [`GET ${API}/offers/${envoyee.id}/messages`]: () => json([]),
    });
    rendreApp(`/communaute/propositions/${envoyee.id}`, fausseAuth(CLIENT));
    expect(await screen.findByText('En attente de réponse')).toBeInTheDocument();
    acceptee = true;
    await act(() => vi.advanceTimersByTimeAsync(INTERVALLE_STATUT_MS));
    expect(await screen.findByText('Acceptée')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Annuler ma proposition' })).not.toBeInTheDocument();
  });

  it("peut être annulée par son auteur ; la conversation est alors close", async () => {
    const envoyee = proposition({ sent: true });
    simulerApi({
      [`GET ${API}/offers/${envoyee.id}`]: () => json(envoyee),
      [`POST ${API}/offers/${envoyee.id}/cancellation`]: () => json({ ...envoyee, status: 'CANCELLED' }),
      [`GET ${API}/offers/${envoyee.id}/messages`]: () => json([message(1, { mine: true })]),
    });
    const { utilisateur } = rendreApp(`/communaute/propositions/${envoyee.id}`, fausseAuth(CLIENT));
    expect(await screen.findByRole('heading', { level: 2, name: 'Conversation avec alice' })).toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: 'Annuler ma proposition' }));
    expect(await screen.findByText('Proposition annulée.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Votre message')).not.toBeInTheDocument();
    expect(screen.getByText(/La conversation est close/)).toBeInTheDocument();
  });

  it("n'est pas révélée à un autre membre (404)", async () => {
    simulerApi({});
    rendreApp('/communaute/propositions/inconnue', fausseAuth(CLIENT));
    expect(await screen.findByRole('heading', { level: 1, name: 'Proposition introuvable' })).toBeInTheDocument();
  });
});
