import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLIENT, MEMBRE_ADMIN, fausseAuth, json, rendreApp, signalement, simulerApi } from '../../test/outils';

afterEach(() => vi.unstubAllGlobals());

const API = '/api/v1/community';

describe('Modération', () => {
  it('liste les signalements à traiter et masque un contenu', async () => {
    let traite = false;
    const fetch = simulerApi({
      [`GET ${API}/moderation/reports`]: () =>
        json(traite ? [] : [signalement(), signalement({ id: 's2', targetType: 'MESSAGE', targetId: '42', excerpt: 'Propos déplacés' })]),
      [`POST ${API}/moderation/reports/${signalement().id}/hide`]: () => {
        traite = true;
        return new Response(null, { status: 204 });
      },
    });
    const { utilisateur } = rendreApp('/admin/moderation', fausseAuth(MEMBRE_ADMIN));
    const tableau = await screen.findByRole('table', { name: 'Signalements : à traiter' });
    expect(within(tableau).getByRole('link', { name: 'Annonce 01' })).toBeInTheDocument();
    expect(within(tableau).getByText('Propos déplacés')).toBeInTheDocument();
    expect(within(tableau).getAllByText('Vente déguisée')).toHaveLength(2);
    await utilisateur.click(within(tableau).getAllByRole('button', { name: /Masquer/ })[0]!);
    expect(await screen.findByText('Contenu masqué ; son auteur est prévenu.')).toBeInTheDocument();
    expect(await screen.findByText('Aucun signalement.')).toBeInTheDocument();
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith('/hide'))).toBe(true);
  });

  it('rejette un signalement et affiche les signalements traités', async () => {
    const fetch = simulerApi({
      [`GET ${API}/moderation/reports`]: (url) =>
        json(
          url.searchParams.get('status') === 'DISMISSED'
            ? [signalement({ status: 'DISMISSED', handledBy: 'admin-pme' })]
            : [signalement()],
        ),
      [`POST ${API}/moderation/reports/${signalement().id}/dismiss`]: () => new Response(null, { status: 204 }),
    });
    const { utilisateur } = rendreApp('/admin/moderation', fausseAuth(MEMBRE_ADMIN));
    await utilisateur.click(await screen.findByRole('button', { name: 'Rejeter le signalement de carol' }));
    expect(await screen.findByText('Signalement rejeté.')).toBeInTheDocument();
    await utilisateur.selectOptions(screen.getByLabelText('Signalements'), 'DISMISSED');
    const tableau = await screen.findByRole('table', { name: 'Signalements : rejetés' });
    expect(within(tableau).getByText('admin-pme')).toBeInTheDocument();
    expect(fetch.mock.calls.some(([url]) => String(url).includes('status=DISMISSED'))).toBe(true);
  });

  it('est réservée aux administrateurs', async () => {
    simulerApi({});
    rendreApp('/admin/moderation', fausseAuth(CLIENT));
    expect(await screen.findByRole('heading', { level: 1, name: 'Accès refusé' })).toBeInTheDocument();
  });
});
