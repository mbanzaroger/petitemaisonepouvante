import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ajouterAuPanier, stockerPanier } from '../cart/panier';
import { CLIENT, commande, fausseAuth, json, produit, rendreApp, simulerApi } from '../test/outils';

/** Le panier est chargé à la demande (fichier séparé) : on attend son titre avant d'interroger la page. */
async function ouvrirPanier(auth?: Parameters<typeof rendreApp>[1]) {
  const rendu = rendreApp('/panier', auth);
  await screen.findByRole('heading', { level: 1, name: 'Panier' });
  return rendu;
}

afterEach(() => vi.unstubAllGlobals());

function remplirPanier() {
  let lignes = ajouterAuPanier([], produit(4), 2).lignes;
  lignes = ajouterAuPanier(lignes, produit(8), 1).lignes;
  stockerPanier(lignes);
}

describe('Panier vide', () => {
  it('invite à parcourir le catalogue', async () => {
    simulerApi({});
    await ouvrirPanier();
    expect(screen.getByText('Votre panier est vide.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Parcourir le catalogue' })).toHaveAttribute('href', '/');
  });
});

describe('Panier', () => {
  beforeEach(remplirPanier);

  it('présente un tableau accessible et recalcule le total', async () => {
    simulerApi({});
    const { utilisateur } = await ouvrirPanier();
    const tableau = screen.getByRole('table', { name: 'Contenu du panier' });
    expect(within(tableau).getAllByRole('columnheader')).toHaveLength(5);
    expect(within(tableau).getByRole('rowheader', { name: 'Produit 04' })).toBeInTheDocument();
    const total = () => within(tableau).getByRole('row', { name: /Total estimé/ });
    expect(total()).toHaveTextContent(/30,16/);
    await utilisateur.selectOptions(screen.getByLabelText('Quantité pour « Produit 08 »'), '3');
    expect(total()).toHaveTextContent(/50,32/);
    await utilisateur.click(screen.getByRole('button', { name: 'Retirer « Produit 04 » du panier' }));
    expect(within(tableau).queryByRole('rowheader', { name: 'Produit 04' })).not.toBeInTheDocument();
    expect(total()).toHaveTextContent(/30,24/);
  });

  it('demande la connexion avant de commander, sans vider le panier', async () => {
    simulerApi({});
    const auth = fausseAuth();
    const { utilisateur } = rendreApp('/panier', auth);
    await utilisateur.click(screen.getByRole('button', { name: 'Se connecter pour commander' }));
    expect(auth.connecter).toHaveBeenCalled();
    expect(screen.getByRole('rowheader', { name: 'Produit 04' })).toBeInTheDocument();
  });

  it('refuse la commande à un compte sans rôle client et propose de changer de compte', async () => {
    simulerApi({});
    const auth = fausseAuth({ connecte: true, utilisateur: 'admin-pme', roles: ['ADMIN'] });
    const { utilisateur } = rendreApp('/panier', auth);
    const alerte = screen.getByRole('alert');
    expect(alerte).toHaveTextContent('« admin-pme » (administrateur)');
    expect(alerte).toHaveTextContent("n'a pas le profil client");
    expect(screen.queryByRole('button', { name: 'Valider la commande' })).not.toBeInTheDocument();
    await utilisateur.click(within(alerte).getByRole('button', { name: 'Changer de compte' }));
    expect(auth.changerDeCompte).toHaveBeenCalled();
  });

  it('propose de se reconnecter quand la session a expiré', async () => {
    simulerApi({ 'POST /api/v1/orders': () => json({ status: 401 }, 401) });
    const auth = fausseAuth(CLIENT);
    const { utilisateur } = rendreApp('/panier', auth);
    await utilisateur.click(screen.getByRole('button', { name: 'Valider la commande' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Votre session a expiré');
    await utilisateur.click(screen.getByRole('button', { name: 'Se reconnecter' }));
    expect(auth.connecter).toHaveBeenCalled();
    expect(screen.getByRole('rowheader', { name: 'Produit 04' })).toBeInTheDocument();
  });

  it('passe la commande, vide le panier et ouvre le suivi', async () => {
    const fetch = simulerApi({
      'POST /api/v1/orders': () => json(commande(), 202),
      [`GET /api/v1/orders/${commande().id}`]: () => json(commande({ status: 'CONFIRMED' })),
    });
    const { utilisateur } = await ouvrirPanier(fausseAuth(CLIENT));
    await utilisateur.click(screen.getByRole('button', { name: 'Valider la commande' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Commande n° 9A1B2C3D' })).toBeInTheDocument();
    expect(screen.getByText('Merci ! Votre commande a bien été enregistrée.')).toBeInTheDocument();
    const init = fetch.mock.calls.find(([, options]) => options?.method === 'POST')![1]!;
    expect(JSON.parse(String(init.body))).toEqual({
      lines: [
        { productId: produit(4).id, quantity: 2 },
        { productId: produit(8).id, quantity: 1 },
      ],
    });
    expect(screen.getByRole('link', { name: /Panier.*\(0 article\)/ })).toBeInTheDocument();
  });

  it('affiche le refus métier et conserve le panier', async () => {
    simulerApi({
      'POST /api/v1/orders': () => json({ status: 422, detail: 'Produit inconnu ou indisponible : x' }, 422),
    });
    const { utilisateur } = await ouvrirPanier(fausseAuth(CLIENT));
    await utilisateur.click(screen.getByRole('button', { name: 'Valider la commande' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Produit inconnu ou indisponible : x');
    expect(screen.getByRole('button', { name: 'Valider la commande' })).toBeEnabled();
    expect(screen.getByRole('rowheader', { name: 'Produit 04' })).toBeInTheDocument();
  });

  it("n'affiche pas l'action de commande tant que la session n'est pas vérifiée", async () => {
    simulerApi({});
    await ouvrirPanier(fausseAuth({ pret: false }));
    expect(screen.queryByRole('button', { name: /commander|Valider/ })).not.toBeInTheDocument();
  });
});

describe('Revalidation du panier', () => {
  beforeEach(remplirPanier);

  it('annonce un changement de prix et met le total à jour', async () => {
    const fetch = simulerApi({
      'GET /api/v1/products': () => json([produit(4, { price: { amountCents: 2000, currency: 'EUR' } }), produit(8)]),
    });
    await ouvrirPanier();
    const annonce = await screen.findByText(/Le prix de « Produit 04 » est passé de/);
    expect(annonce).toHaveTextContent(/10,04.*20,00/);
    expect(screen.getByRole('row', { name: /Total estimé/ })).toHaveTextContent(/50,08/);
    const url = String(fetch.mock.calls[0]![0]);
    expect(url).toContain('ids=');
    expect(decodeURIComponent(url)).toContain(produit(4).id);
  });

  it('signale un produit devenu indisponible et bloque la validation', async () => {
    simulerApi({ 'GET /api/v1/products': () => json([produit(4, { available: false }), produit(8)]) });
    const { utilisateur } = await ouvrirPanier(fausseAuth(CLIENT));
    expect(await screen.findByText('Indisponible')).toBeInTheDocument();
    const bouton = screen.getByRole('button', { name: 'Valider la commande' });
    expect(bouton).toBeDisabled();
    expect(bouton).toHaveAccessibleDescription('Retirez les produits indisponibles pour valider la commande.');
    await utilisateur.click(screen.getByRole('button', { name: 'Retirer « Produit 04 » du panier' }));
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Valider la commande' })).toBeEnabled());
  });

  it('traite un produit disparu du catalogue comme indisponible', async () => {
    simulerApi({ 'GET /api/v1/products': () => json([produit(8)]) });
    await ouvrirPanier(fausseAuth(CLIENT));
    expect(await screen.findByText('Indisponible')).toBeInTheDocument();
  });
});

