import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CLIENT,
  SANS_ROLE,
  annonce,
  corpsEnvoye,
  fausseAuth,
  json,
  message,
  page,
  proposition,
  rendreApp,
  simulerApi,
} from '../../test/outils';

afterEach(() => vi.unstubAllGlobals());

const API = '/api/v1/community';

describe('Annonces de troc', () => {
  it('sont consultables sans connexion, avec une invitation à se connecter pour publier', async () => {
    simulerApi({ [`GET ${API}/listings`]: () => json(page([annonce(1), annonce(2, { type: 'GIFT', wanted: null })])) });
    const auth = fausseAuth();
    const { utilisateur } = rendreApp('/communaute', auth);
    expect(await screen.findByRole('heading', { level: 1, name: 'Troc et dons' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Annonce 01' })).toHaveAttribute(
      'href',
      `/communaute/annonces/${annonce(1).id}`,
    );
    expect(screen.getByText('2 annonces')).toBeInTheDocument();
    expect(screen.getByText('Recherche en échange : Un Blu-ray')).toBeInTheDocument();
    expect(screen.getByText('Don', { selector: '.etiquette' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Publier une annonce' })).not.toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: 'Se connecter pour publier' }));
    expect(auth.connecter).toHaveBeenCalled();
  });

  it('filtrent par type, catégorie et texte (paramètres envoyés au service)', async () => {
    const fetch = simulerApi({ [`GET ${API}/listings`]: () => json(page([])) });
    const { utilisateur } = rendreApp('/communaute', fausseAuth(CLIENT));
    expect(await screen.findByText('Aucune annonce')).toBeInTheDocument();
    await utilisateur.selectOptions(screen.getByLabelText('Type'), 'GIFT');
    await utilisateur.selectOptions(screen.getByLabelText('Catégorie'), 'BOARD_GAMES');
    await utilisateur.type(screen.getByLabelText('Rechercher'), 'cryptes');
    await utilisateur.click(screen.getByRole('button', { name: 'Filtrer' }));
    await vi.waitFor(() => {
      const url = new URL(String(fetch.mock.calls.at(-1)![0]), 'http://localhost');
      expect(url.searchParams.get('type')).toBe('GIFT');
      expect(url.searchParams.get('category')).toBe('BOARD_GAMES');
      expect(url.searchParams.get('q')).toBe('cryptes');
    });
    expect(fetch.mock.calls.at(-1)![1]!.headers).toMatchObject({ Authorization: 'Bearer jeton-de-test' });
  });

  it('signalent les annonces du membre et proposent la publication', async () => {
    simulerApi({ [`GET ${API}/listings`]: () => json(page([annonce(3, { mine: true })])) });
    rendreApp('/communaute', fausseAuth(CLIENT));
    expect(await screen.findByText(/Votre annonce/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Publier une annonce' })).toHaveAttribute('href', '/communaute/publier');
  });
});

describe('Publication', () => {
  it("publie un échange avec sa contrepartie puis affiche l'annonce", async () => {
    const creee = annonce(5, { title: 'Figurine à échanger', mine: true });
    const fetch = simulerApi({
      [`POST ${API}/listings`]: () => json(creee, 201),
      [`GET ${API}/listings/${creee.id}`]: () => json(creee),
    });
    const { utilisateur } = rendreApp('/communaute/publier', fausseAuth(CLIENT));
    await utilisateur.type(await screen.findByLabelText(/Titre/), 'Figurine à échanger');
    await utilisateur.type(screen.getByLabelText(/Description/), 'Figurine en parfait état, boîte incluse.');
    await utilisateur.selectOptions(screen.getByLabelText('Catégorie'), 'FIGURINES');
    await utilisateur.selectOptions(screen.getByLabelText("État de l'objet"), 'LIKE_NEW');
    await utilisateur.type(screen.getByLabelText(/Ce que vous recherchez/), 'Un Blu-ray');
    await utilisateur.click(screen.getByRole('button', { name: "Publier l'annonce" }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Figurine à échanger' })).toBeInTheDocument();
    expect(screen.getByText(/Votre annonce est publiée/)).toBeInTheDocument();
    expect(corpsEnvoye(fetch, 'POST', `${API}/listings`)).toEqual({
      type: 'EXCHANGE',
      title: 'Figurine à échanger',
      description: 'Figurine en parfait état, boîte incluse.',
      category: 'FIGURINES',
      condition: 'LIKE_NEW',
      wanted: 'Un Blu-ray',
    });
  });

  it("n'envoie pas de contrepartie pour un don et affiche le refus du service", async () => {
    const fetch = simulerApi({ [`POST ${API}/listings`]: () => json({ status: 400, detail: 'x' }, 400) });
    const { utilisateur } = rendreApp('/communaute/publier', fausseAuth(CLIENT));
    await utilisateur.click(await screen.findByLabelText('Don gratuit'));
    expect(screen.queryByLabelText(/Ce que vous recherchez/)).not.toBeInTheDocument();
    await utilisateur.type(screen.getByLabelText(/Titre/), 'Magazines');
    await utilisateur.type(screen.getByLabelText(/Description/), 'Lot de magazines à donner.');
    await utilisateur.selectOptions(screen.getByLabelText('Catégorie'), 'BOOKS_COMICS');
    await utilisateur.selectOptions(screen.getByLabelText("État de l'objet"), 'USED');
    await utilisateur.click(screen.getByRole('button', { name: "Publier l'annonce" }));
    expect(await screen.findByRole('alert')).toHaveTextContent('La demande est invalide.');
    const corps = corpsEnvoye(fetch, 'POST', `${API}/listings`);
    expect(corps).toMatchObject({ type: 'GIFT', category: 'BOOKS_COMICS' });
    expect(corps).not.toHaveProperty('wanted');
  });

  it('est réservée aux membres', () => {
    simulerApi({});
    rendreApp('/communaute/publier', fausseAuth(SANS_ROLE));
    expect(screen.getByRole('heading', { level: 1, name: 'Accès refusé' })).toBeInTheDocument();
  });
});

describe("Détail d'une annonce", () => {
  const a = annonce(1);

  it('invite un visiteur à se connecter pour faire une proposition', async () => {
    simulerApi({ [`GET ${API}/listings/${a.id}`]: () => json(a) });
    const auth = fausseAuth();
    const { utilisateur } = rendreApp(`/communaute/annonces/${a.id}`, auth);
    expect(await screen.findByRole('heading', { level: 1, name: 'Annonce 01' })).toBeInTheDocument();
    expect(screen.getByText('Bon état')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Signaler/ })).not.toBeInTheDocument();
    await utilisateur.click(within(screen.getByRole('main')).getByRole('button', { name: 'Se connecter' }));
    expect(auth.connecter).toHaveBeenCalled();
  });

  it("permet à un membre de proposer un échange et ouvre la conversation", async () => {
    const offre = proposition({ sent: true });
    const fetch = simulerApi({
      [`GET ${API}/listings/${a.id}`]: () => json(a),
      [`POST ${API}/listings/${a.id}/offers`]: () => json(offre, 201),
      [`GET ${API}/offers/${offre.id}`]: () => json(offre),
      [`GET ${API}/offers/${offre.id}/messages`]: () => json([message(1, { content: 'Je propose une affiche.', mine: true })]),
    });
    const { utilisateur } = rendreApp(`/communaute/annonces/${a.id}`, fausseAuth(CLIENT));
    await utilisateur.type(await screen.findByLabelText(/Votre message à lucie/), 'Je propose une affiche.');
    await utilisateur.click(screen.getByRole('button', { name: 'Envoyer la proposition' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Proposition pour « Annonce 01 »' })).toBeInTheDocument();
    expect(screen.getByText(/Votre proposition a été envoyée à alice/)).toBeInTheDocument();
    expect(corpsEnvoye(fetch, 'POST', `${API}/listings/${a.id}/offers`)).toEqual({ message: 'Je propose une affiche.' });
    expect(await screen.findByText('Je propose une affiche.', { selector: '.message-texte' })).toBeInTheDocument();
  });

  it('affiche le conflit renvoyé par le service (proposition déjà en attente)', async () => {
    simulerApi({
      [`GET ${API}/listings/${a.id}`]: () => json(a),
      [`POST ${API}/listings/${a.id}/offers`]: () =>
        json({ status: 409, detail: 'Vous avez déjà une proposition en attente sur cette annonce.' }, 409),
    });
    const { utilisateur } = rendreApp(`/communaute/annonces/${a.id}`, fausseAuth(CLIENT));
    await utilisateur.type(await screen.findByLabelText(/Votre message/), 'Encore moi');
    await utilisateur.click(screen.getByRole('button', { name: 'Envoyer la proposition' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Vous avez déjà une proposition en attente');
  });

  it("permet à l'auteur de retirer son annonce", async () => {
    const mienne = annonce(1, { mine: true });
    let retiree = false;
    const fetch = simulerApi({
      [`GET ${API}/listings/${a.id}`]: () => json(retiree ? { ...mienne, status: 'WITHDRAWN' } : mienne),
      [`POST ${API}/listings/${a.id}/withdrawal`]: () => {
        retiree = true;
        return new Response(null, { status: 204 });
      },
    });
    const { utilisateur } = rendreApp(`/communaute/annonces/${a.id}`, fausseAuth(CLIENT));
    expect(await screen.findByText('vous')).toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: "Retirer l'annonce" }));
    expect(await screen.findByText(/Votre annonce est retirée/)).toBeInTheDocument();
    expect(await screen.findByText('Retirée')).toBeInTheDocument();
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(true);
  });

  it("indique qu'une annonce conclue n'est plus disponible et permet de la signaler", async () => {
    const fetch = simulerApi({
      [`GET ${API}/listings/${a.id}`]: () => json({ ...a, status: 'CONCLUDED' }),
      [`POST ${API}/reports`]: () => new Response(null, { status: 202 }),
    });
    const { utilisateur } = rendreApp(`/communaute/annonces/${a.id}`, fausseAuth(CLIENT));
    expect(await screen.findByText("Cette annonce n'est plus disponible.")).toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: 'Signaler cette annonce' }));
    await utilisateur.type(screen.getByLabelText(/Motif du signalement/), 'Vente déguisée');
    await utilisateur.click(screen.getByRole('button', { name: 'Envoyer le signalement' }));
    expect(await screen.findByText(/la modération va examiner ce contenu/)).toBeInTheDocument();
    expect(corpsEnvoye(fetch, 'POST', `${API}/reports`)).toEqual({
      targetType: 'LISTING',
      targetId: a.id,
      reason: 'Vente déguisée',
    });
  });

  it("refuse la proposition à un compte sans profil client et gère l'annonce introuvable", async () => {
    simulerApi({ [`GET ${API}/listings/${a.id}`]: () => json(a) });
    const bob = fausseAuth(SANS_ROLE);
    const { unmount, utilisateur } = rendreApp(`/communaute/annonces/${a.id}`, bob);
    const alerte = await screen.findByRole('alert');
    expect(alerte).toHaveTextContent("n'a pas le profil client");
    await utilisateur.click(within(alerte).getByRole('button', { name: 'Changer de compte' }));
    expect(bob.changerDeCompte).toHaveBeenCalled();
    unmount();
    simulerApi({});
    rendreApp('/communaute/annonces/inconnue', fausseAuth(CLIENT));
    expect(await screen.findByRole('heading', { level: 1, name: 'Annonce introuvable' })).toBeInTheDocument();
    expect(within(screen.getByRole('main')).getByRole('link', { name: 'Retour aux annonces' })).toBeInTheDocument();
  });
});
