import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ajouterAuPanier, stockerPanier } from '../cart/panier';
import { CLIENT, commande, fausseAuth, json, produit, rendreApp, simulerApi } from '../test/outils';

afterEach(() => vi.unstubAllGlobals());

function remplirPanier() {
  let lignes = ajouterAuPanier([], produit(4), 2).lignes;
  lignes = ajouterAuPanier(lignes, produit(8), 1).lignes;
  stockerPanier(lignes);
}

describe('Panier vide', () => {
  it('invite à parcourir le catalogue', () => {
    simulerApi({});
    rendreApp('/panier');
    expect(screen.getByText('Votre panier est vide.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Parcourir le catalogue' })).toHaveAttribute('href', '/');
  });
});

describe('Panier', () => {
  beforeEach(remplirPanier);

  it('présente un tableau accessible et recalcule le total', async () => {
    simulerApi({});
    const { utilisateur } = rendreApp('/panier');
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

  it('refuse la commande à un compte sans rôle client', () => {
    simulerApi({});
    rendreApp('/panier', fausseAuth({ connecte: true, utilisateur: 'bob', roles: [] }));
    expect(screen.getByRole('alert')).toHaveTextContent("n'a pas le profil client");
    expect(screen.queryByRole('button', { name: 'Valider la commande' })).not.toBeInTheDocument();
  });

  it('passe la commande, vide le panier et ouvre le suivi', async () => {
    const fetch = simulerApi({
      'POST /api/v1/orders': () => json(commande(), 202),
      [`GET /api/v1/orders/${commande().id}`]: () => json(commande({ status: 'CONFIRMED' })),
    });
    const { utilisateur } = rendreApp('/panier', fausseAuth(CLIENT));
    await utilisateur.click(screen.getByRole('button', { name: 'Valider la commande' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Commande n° 9A1B2C3D' })).toBeInTheDocument();
    expect(screen.getByText('Merci ! Votre commande a bien été enregistrée.')).toBeInTheDocument();
    const init = fetch.mock.calls[0]![1]!;
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
    const { utilisateur } = rendreApp('/panier', fausseAuth(CLIENT));
    await utilisateur.click(screen.getByRole('button', { name: 'Valider la commande' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Produit inconnu ou indisponible : x');
    expect(screen.getByRole('button', { name: 'Valider la commande' })).toBeEnabled();
    expect(screen.getByRole('rowheader', { name: 'Produit 04' })).toBeInTheDocument();
  });

  it("n'affiche pas l'action de commande tant que la session n'est pas vérifiée", () => {
    simulerApi({});
    rendreApp('/panier', fausseAuth({ pret: false }));
    expect(screen.queryByRole('button', { name: /commander|Valider/ })).not.toBeInTheDocument();
  });
});
