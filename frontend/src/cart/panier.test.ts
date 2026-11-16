import { describe, expect, it } from 'vitest';
import { produit } from '../test/outils';
import {
  LIGNES_MAX,
  ajouterAuPanier,
  lirePanierStocke,
  modifierQuantite,
  nombreArticles,
  retirerDuPanier,
  stockerPanier,
  totalPanier,
  type LignePanier,
} from './panier';

describe('panier', () => {
  it('ajoute un produit puis cumule les quantités', () => {
    const premier = ajouterAuPanier([], produit(1), 2);
    expect(premier.accepte).toBe(true);
    expect(premier.lignes).toEqual([
      { productId: produit(1).id, nom: 'Produit 01', prixCentimes: 1001, devise: 'EUR', quantite: 2 },
    ]);
    const second = ajouterAuPanier(premier.lignes, produit(1), 3);
    expect(second.lignes[0]?.quantite).toBe(5);
    expect(second.message).toContain('portée à 5');
  });

  it('plafonne la quantité à 10 par produit, comme l’API', () => {
    const plein = ajouterAuPanier([], produit(1), 10).lignes;
    const resultat = ajouterAuPanier(plein, produit(1), 1);
    expect(resultat.accepte).toBe(false);
    expect(resultat.lignes[0]?.quantite).toBe(10);
    expect(resultat.message).toContain('limitée à 10');
    expect(ajouterAuPanier([], produit(2), 99).lignes[0]?.quantite).toBe(10);
  });

  it('refuse un 21e produit différent', () => {
    let lignes: LignePanier[] = [];
    for (let i = 1; i <= LIGNES_MAX; i++) lignes = ajouterAuPanier(lignes, produit(i), 1).lignes;
    const resultat = ajouterAuPanier(lignes, produit(50), 1);
    expect(resultat.accepte).toBe(false);
    expect(resultat.lignes).toHaveLength(LIGNES_MAX);
  });

  it('modifie, retire et totalise', () => {
    let lignes = ajouterAuPanier([], produit(1), 1).lignes;
    lignes = ajouterAuPanier(lignes, produit(2), 1).lignes;
    lignes = modifierQuantite(lignes, produit(1).id, 3);
    expect(nombreArticles(lignes)).toBe(4);
    expect(totalPanier(lignes)).toBe(3 * 1001 + 1002);
    expect(modifierQuantite(lignes, produit(1).id, 0)[0]?.quantite).toBe(1);
    expect(retirerDuPanier(lignes, produit(1).id)).toHaveLength(1);
  });

  it('se conserve dans le stockage de session et ignore les données altérées', () => {
    const lignes = ajouterAuPanier([], produit(1), 2).lignes;
    stockerPanier(lignes);
    expect(lirePanierStocke()).toEqual(lignes);
    sessionStorage.setItem('pme.panier', JSON.stringify([{ productId: 1 }, { ...lignes[0], quantite: 50 }]));
    expect(lirePanierStocke()).toEqual([{ ...lignes[0], quantite: 10 }]);
    sessionStorage.setItem('pme.panier', '{pas du json');
    expect(lirePanierStocke()).toEqual([]);
    sessionStorage.setItem('pme.panier', '{"a":1}');
    expect(lirePanierStocke()).toEqual([]);
  });

  it('reste utilisable si le stockage est indisponible', () => {
    const stockage = {
      setItem: () => {
        throw new Error('quota');
      },
    } as unknown as Storage;
    expect(() => stockerPanier([], stockage)).not.toThrow();
  });
});
