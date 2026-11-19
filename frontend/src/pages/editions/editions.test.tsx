import { act, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Abonnement, Numero } from '../../api/editions';
import { CLIENT, MEMBRE_ADMIN, corpsEnvoye, fausseAuth, json, page, rendreApp, simulerApi } from '../../test/outils';

afterEach(() => vi.unstubAllGlobals());

const API = '/api/v1/editorial';

function numero(n: number, surcharge: Partial<Numero> = {}): Numero {
  return {
    number: n,
    title: `Numéro ${n} — Titre`,
    summary: `Sommaire du numéro ${n}`,
    publishedOn: '2026-09-01',
    priceCents: 390,
    pageCount: 3,
    access: 'PREVIEW',
    ...surcharge,
  };
}

const SANS_ABONNEMENT: Abonnement = {
  active: false,
  plan: null,
  planLabel: null,
  startsOn: null,
  endsOn: null,
  renewable: false,
  address: null,
};

const FORMULES = [
  { code: 'DIGITAL', label: 'Numérique', priceCents: 2400, paper: false },
  { code: 'PAPER_DIGITAL', label: 'Papier et numérique', priceCents: 3900, paper: true },
];

function pageNumero(n: number, p: number, access: Numero['access'] = 'PREVIEW') {
  return { issueNumber: n, pageNo: p, pageCount: 3, title: `Titre ${p}`, content: `Premier paragraphe ${p}.\n\nSecond paragraphe ${p}.`, access };
}

describe('Actualités et articles (US15)', () => {
  it('liste les articles, filtre par type et affiche un article en paragraphes', async () => {
    const fetch = simulerApi({
      [`GET ${API}/articles`]: () =>
        json(page([{ id: 'a1', slug: 'evil-ed', kind: 'NEWS', title: 'La gamme Evil Ed', summary: 'Résumé', author: 'équipe PME', publishedAt: '2026-11-16T10:00:00Z' }])),
      [`GET ${API}/articles/evil-ed`]: () =>
        json({ id: 'a1', slug: 'evil-ed', kind: 'NEWS', title: 'La gamme Evil Ed', summary: 'Résumé', body: 'Un.\n\nDeux.', author: 'équipe PME', publishedAt: '2026-11-16T10:00:00Z' }),
    });
    const { utilisateur } = rendreApp('/actualites');
    await utilisateur.click(await screen.findByRole('link', { name: 'Articles de fond' }));
    await vi.waitFor(() => expect(fetch.mock.calls.some(([u]) => String(u).includes('kind=FEATURE'))).toBe(true));
    await utilisateur.click(await screen.findByRole('link', { name: 'La gamme Evil Ed' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'La gamme Evil Ed' })).toBeInTheDocument();
    expect(screen.getByText('Un.')).toBeInTheDocument();
    expect(screen.getByText('Deux.')).toBeInTheDocument();
  });

  it('indique un article introuvable', async () => {
    simulerApi({});
    rendreApp('/actualites/inconnu');
    expect(await screen.findByRole('heading', { level: 1, name: 'Article introuvable' })).toBeInTheDocument();
  });
});

describe('Fanzine numérique (US16)', () => {
  it("propose l'extrait à un visiteur et l'achat à un membre, puis ouvre la liseuse", async () => {
    let achete = false;
    const fetch = simulerApi({
      [`GET ${API}/issues`]: () => json([numero(37, { access: achete ? 'PURCHASE' : 'PREVIEW' }), numero(36, { access: 'SUBSCRIPTION' })]),
      [`GET ${API}/plans`]: () => json(FORMULES),
      [`POST ${API}/issues/37/purchase`]: () => {
        achete = true;
        return json(numero(37, { access: 'PURCHASE' }), 201);
      },
      [`GET ${API}/issues/37`]: () => json({ issue: numero(37, { access: 'PURCHASE' }), contents: ['Édito', 'Dossier', 'Lexique'] }),
      [`GET ${API}/issues/37/pages/2`]: () => json(pageNumero(37, 2, 'PURCHASE')),
      [`PUT ${API}/library/37/progress`]: () => new Response(null, { status: 204 }),
    });
    const { utilisateur } = rendreApp('/fanzine', fausseAuth(CLIENT));
    expect(await screen.findByText('Inclus dans votre abonnement')).toBeInTheDocument();
    expect(screen.getByText(/Papier et numérique/)).toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: /Acheter le numéro 37 \(3,90\s€\)/ }));
    expect(await screen.findByText(/Numéro ajouté à votre bibliothèque/)).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 2, name: 'Page 2 sur 3 : Titre 2' })).toBeInTheDocument();
    await vi.waitFor(() => expect(corpsEnvoye(fetch, 'PUT', `${API}/library/37/progress`)).toEqual({ page: 2 }));
  });

  it("réserve la suite d'un numéro et permet de tourner les pages au clavier", async () => {
    simulerApi({
      [`GET ${API}/issues/35`]: () => json({ issue: numero(35), contents: ['Édito', 'Dossier', 'Lexique'] }),
      [`GET ${API}/issues/35/pages/1`]: () => json(pageNumero(35, 1)),
      [`GET ${API}/issues/35/pages/2`]: () => json({ status: 403, detail: 'Achetez ce numéro ou abonnez-vous pour lire la suite.' }, 403),
    });
    const { utilisateur } = rendreApp('/fanzine/35/lecture', fausseAuth(CLIENT));
    expect(await screen.findByText('Premier paragraphe 1.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Page précédente' })).toBeDisabled();
    await act(async () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });
    expect(await screen.findByText('Achetez ce numéro ou abonnez-vous pour lire la suite.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Acheter ce numéro \(3,90\s€\)/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "S'abonner" })).toHaveAttribute('href', '/fanzine/abonnement');
    await utilisateur.selectOptions(screen.getByLabelText('Aller à la page'), '1');
    expect(await screen.findByText('Premier paragraphe 1.')).toBeInTheDocument();
  });

  it('invite un visiteur à se connecter pour lire la suite', async () => {
    simulerApi({
      [`GET ${API}/issues/35`]: () => json({ issue: numero(35), contents: ['Édito', 'Dossier', 'Lexique'] }),
      [`GET ${API}/issues/35/pages/2`]: () => json({ status: 401 }, 401),
    });
    const auth = fausseAuth();
    const { utilisateur } = rendreApp('/fanzine/35/lecture?page=2', auth);
    await utilisateur.click(await screen.findByRole('button', { name: 'Se connecter pour lire la suite' }));
    expect(auth.connecter).toHaveBeenCalled();
  });
});

describe('Abonnement (US17)', () => {
  it("souscrit à la formule papier avec une adresse de livraison", async () => {
    let abonne = false;
    const fetch = simulerApi({
      [`GET ${API}/subscription`]: () =>
        json(abonne ? { ...SANS_ABONNEMENT, active: true, plan: 'PAPER_DIGITAL', planLabel: 'Papier et numérique', endsOn: '2027-11-17', address: { recipient: 'Alice', street: '1 rue', postalCode: '75011', city: 'Paris' } } : SANS_ABONNEMENT),
      [`GET ${API}/plans`]: () => json(FORMULES),
      [`POST ${API}/subscription`]: () => {
        abonne = true;
        return json({ ...SANS_ABONNEMENT, active: true, plan: 'PAPER_DIGITAL', planLabel: 'Papier et numérique', endsOn: '2027-11-17' }, 201);
      },
    });
    const { utilisateur } = rendreApp('/fanzine/abonnement', fausseAuth(CLIENT));
    expect(await screen.findByText("Vous n'êtes pas abonné.")).toBeInTheDocument();
    await utilisateur.click(screen.getByLabelText(/Papier et numérique/));
    await utilisateur.type(screen.getByLabelText('Nom du destinataire'), 'Alice');
    await utilisateur.type(screen.getByLabelText('Adresse'), '1 rue');
    await utilisateur.type(screen.getByLabelText(/Code postal/), '75011');
    await utilisateur.type(screen.getByLabelText('Ville'), 'Paris');
    await utilisateur.click(screen.getByRole('button', { name: "S'abonner" }));
    expect(await screen.findByText(/Abonnement souscrit : Papier et numérique, jusqu'au 17 novembre 2027/)).toBeInTheDocument();
    expect(corpsEnvoye(fetch, 'POST', `${API}/subscription`)).toEqual({
      plan: 'PAPER_DIGITAL',
      address: { recipient: 'Alice', street: '1 rue', postalCode: '75011', city: 'Paris' },
    });
    expect(await screen.findByText('En cours')).toBeInTheDocument();
  });

  it("n'ouvre le renouvellement qu'à l'approche de l'échéance", async () => {
    simulerApi({
      [`GET ${API}/subscription`]: () =>
        json({ ...SANS_ABONNEMENT, active: true, plan: 'DIGITAL', planLabel: 'Numérique', endsOn: '2027-11-17', renewable: false }),
      [`GET ${API}/plans`]: () => json(FORMULES),
    });
    rendreApp('/fanzine/abonnement', fausseAuth(CLIENT));
    expect(await screen.findByRole('button', { name: "Renouveler l'abonnement" })).toBeDisabled();
    expect(screen.getByText(/Le renouvellement sera ouvert dans les 60 jours/)).toBeInTheDocument();
  });
});

describe('Rédaction (ADMIN)', () => {
  it("publie un article et affiche la liste d'expédition", async () => {
    const fetch = simulerApi({
      [`GET ${API}/admin/paper-subscribers`]: () =>
        json([{ memberName: 'alice', address: { recipient: 'Alice', street: '1 rue', postalCode: '75011', city: 'Paris' }, endsOn: '2027-11-17' }]),
      [`POST ${API}/admin/articles`]: () =>
        json({ id: 'a9', slug: 'nouvelle', kind: 'NEWS', title: 'Nouvelle', summary: 's', body: 'b', author: 'admin-pme', publishedAt: '2026-11-18T10:00:00Z' }, 201),
    });
    const { utilisateur } = rendreApp('/admin/redaction', fausseAuth(MEMBRE_ADMIN));
    const tableau = await screen.findByRole('table', { name: "Liste d'expédition du prochain numéro" });
    expect(within(tableau).getByText(/75011 Paris/)).toBeInTheDocument();
    await utilisateur.type(screen.getByLabelText(/Titre/), 'Nouvelle');
    await utilisateur.type(screen.getByLabelText(/Résumé/), 'Un résumé assez long');
    await utilisateur.type(screen.getByLabelText(/Texte/), 'Un texte suffisamment long pour être publié.');
    await utilisateur.click(screen.getByRole('button', { name: 'Publier' }));
    expect(await screen.findByRole('link', { name: 'Nouvelle' })).toHaveAttribute('href', '/actualites/nouvelle');
    expect(corpsEnvoye(fetch, 'POST', `${API}/admin/articles`)).toMatchObject({ kind: 'NEWS', title: 'Nouvelle' });
  });
});
