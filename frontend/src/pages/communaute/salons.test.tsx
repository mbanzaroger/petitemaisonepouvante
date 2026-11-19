import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLIENT, corpsEnvoye, fausseAuth, json, message, rendreApp, simulerApi } from '../../test/outils';

afterEach(() => vi.unstubAllGlobals());

const API = '/api/v1/community';
const SALONS = [
  { code: 'general', name: 'Discussions générales', description: 'Présentez-vous.' },
  { code: 'films', name: 'Films et Blu-ray', description: 'Coups de cœur.' },
];

describe('Salons de discussion', () => {
  it('sont listés pour un membre', async () => {
    simulerApi({ [`GET ${API}/rooms`]: () => json(SALONS) });
    rendreApp('/communaute/salons', fausseAuth(CLIENT));
    expect(await screen.findByRole('link', { name: 'Films et Blu-ray' })).toHaveAttribute('href', '/communaute/salons/films');
  });

  it('demandent une connexion', async () => {
    simulerApi({});
    rendreApp('/communaute/salons', fausseAuth());
    expect(await screen.findByRole('heading', { level: 1, name: 'Connexion requise' })).toBeInTheDocument();
    expect(screen.getByText("Connectez-vous pour accéder à l'espace communautaire.")).toBeInTheDocument();
  });

  it('affichent les messages, publient un nouveau message et permettent de signaler celui des autres', async () => {
    const fetch = simulerApi({
      [`GET ${API}/rooms`]: () => json(SALONS),
      [`GET ${API}/rooms/films/messages`]: () => json([message(3, { author: 'hugo', content: 'Superbe restauration !' })]),
      [`POST ${API}/rooms/films/messages`]: () => json(message(4, { mine: true, author: 'alice', content: 'Je confirme' }), 201),
      [`POST ${API}/reports`]: () => new Response(null, { status: 202 }),
    });
    const { utilisateur } = rendreApp('/communaute/salons/films', fausseAuth(CLIENT));
    expect(await screen.findByRole('heading', { level: 1, name: 'Films et Blu-ray' })).toBeInTheDocument();
    const fil = screen.getByRole('log', { name: 'Messages : Films et Blu-ray' });
    expect(await within(fil).findByText('Superbe restauration !')).toBeInTheDocument();

    await utilisateur.type(screen.getByLabelText('Votre message'), 'Je confirme');
    await utilisateur.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await within(fil).findByText('Je confirme')).toBeInTheDocument();
    expect(corpsEnvoye(fetch, 'POST', `${API}/rooms/films/messages`)).toEqual({ content: 'Je confirme' });
    expect(within(fil).getAllByRole('button', { name: /Signaler/ })).toHaveLength(1);

    await utilisateur.click(within(fil).getByRole('button', { name: 'Signaler le message de hugo' }));
    await utilisateur.type(within(fil).getByLabelText(/Motif du signalement/), 'Hors sujet');
    await utilisateur.click(within(fil).getByRole('button', { name: 'Envoyer le signalement' }));
    expect(await within(fil).findByText(/la modération va examiner ce contenu/)).toBeInTheDocument();
    expect(corpsEnvoye(fetch, 'POST', `${API}/reports`)).toEqual({ targetType: 'MESSAGE', targetId: '3', reason: 'Hors sujet' });
  });

  it("affiche la limitation anti-flood et permet d'annuler un signalement", async () => {
    simulerApi({
      [`GET ${API}/rooms`]: () => json(SALONS),
      [`GET ${API}/rooms/general/messages`]: () => json([message(1)]),
      [`POST ${API}/rooms/general/messages`]: () =>
        json({ status: 429, detail: 'Vous envoyez des messages trop rapidement : patientez quelques secondes.' }, 429),
    });
    const { utilisateur } = rendreApp('/communaute/salons/general', fausseAuth(CLIENT));
    await utilisateur.type(await screen.findByLabelText('Votre message'), 'Encore');
    await utilisateur.click(screen.getByRole('button', { name: 'Envoyer' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('patientez quelques secondes');
    expect(screen.getByLabelText('Votre message')).toHaveValue('Encore');

    await utilisateur.click(screen.getByRole('button', { name: 'Signaler le message de carol' }));
    await utilisateur.click(screen.getByRole('button', { name: 'Annuler' }));
    expect(screen.queryByLabelText(/Motif du signalement/)).not.toBeInTheDocument();
  });

  it('indique un salon inconnu', async () => {
    simulerApi({ [`GET ${API}/rooms`]: () => json(SALONS) });
    rendreApp('/communaute/salons/inconnu', fausseAuth(CLIENT));
    expect(await screen.findByRole('heading', { level: 1, name: 'Salon introuvable' })).toBeInTheDocument();
  });
});
