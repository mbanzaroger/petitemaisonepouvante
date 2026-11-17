import type { Product } from '../api/types';
import { formaterPrix } from '../format';

// Mêmes bornes que la validation de l'API (PlaceOrderRequest) : 1 à 10 par ligne, 20 lignes au plus.
export const QUANTITE_MAX = 10;
export const LIGNES_MAX = 20;
const CLE_STOCKAGE = 'pme.panier';

export interface LignePanier {
  productId: string;
  nom: string;
  prixCentimes: number;
  devise: string;
  quantite: number;
}

export interface ResultatAjout {
  lignes: LignePanier[];
  message: string;
  accepte: boolean;
}

function borner(quantite: number): number {
  return Math.min(QUANTITE_MAX, Math.max(1, Math.trunc(quantite)));
}

export function ajouterAuPanier(lignes: LignePanier[], produit: Product, quantite: number): ResultatAjout {
  const existante = lignes.find((ligne) => ligne.productId === produit.id);
  if (!existante) {
    if (lignes.length >= LIGNES_MAX) {
      return { lignes, accepte: false, message: `Le panier est limité à ${LIGNES_MAX} produits différents.` };
    }
    const ligne: LignePanier = {
      productId: produit.id,
      nom: produit.name,
      prixCentimes: produit.price.amountCents,
      devise: produit.price.currency,
      quantite: borner(quantite),
    };
    return { lignes: [...lignes, ligne], accepte: true, message: `« ${produit.name} » a été ajouté au panier.` };
  }
  const souhaitee = existante.quantite + Math.trunc(quantite);
  const retenue = borner(souhaitee);
  const message =
    retenue < souhaitee
      ? `Quantité de « ${produit.name} » limitée à ${QUANTITE_MAX} par commande.`
      : `Quantité de « ${produit.name} » portée à ${retenue}.`;
  return {
    lignes: lignes.map((ligne) => (ligne.productId === produit.id ? { ...ligne, quantite: retenue } : ligne)),
    accepte: retenue > existante.quantite,
    message,
  };
}

export function modifierQuantite(lignes: LignePanier[], productId: string, quantite: number): LignePanier[] {
  return lignes.map((ligne) => (ligne.productId === productId ? { ...ligne, quantite: borner(quantite) } : ligne));
}

export function retirerDuPanier(lignes: LignePanier[], productId: string): LignePanier[] {
  return lignes.filter((ligne) => ligne.productId !== productId);
}

/**
 * Aligne le panier sur le catalogue (prix et noms à jour) et décrit les changements de prix à annoncer.
 * Renvoie le même tableau s'il n'y a rien à changer (pas de rendu inutile).
 */
export function synchroniserPanier(
  lignes: LignePanier[],
  produits: Product[],
): { lignes: LignePanier[]; changements: string[] } {
  const parId = new Map(produits.map((produit) => [produit.id, produit]));
  const changements: string[] = [];
  let modifie = false;
  const nouvelles = lignes.map((ligne) => {
    const produit = parId.get(ligne.productId);
    if (!produit) return ligne;
    const prix = produit.price.amountCents;
    if (prix === ligne.prixCentimes && produit.name === ligne.nom && produit.price.currency === ligne.devise) {
      return ligne;
    }
    modifie = true;
    if (prix !== ligne.prixCentimes) {
      changements.push(
        `Le prix de « ${produit.name} » est passé de ${formaterPrix(ligne.prixCentimes, ligne.devise)} à ${formaterPrix(prix, produit.price.currency)}.`,
      );
    }
    return { ...ligne, nom: produit.name, prixCentimes: prix, devise: produit.price.currency };
  });
  return { lignes: modifie ? nouvelles : lignes, changements };
}

/** Lignes dont le produit n'existe plus ou n'est plus disponible à la vente. */
export function lignesIndisponibles(lignes: LignePanier[], produits: Product[]): Set<string> {
  const disponibles = new Set(produits.filter((p) => p.available).map((p) => p.id));
  return new Set(lignes.filter((l) => !disponibles.has(l.productId)).map((l) => l.productId));
}

export function totalPanier(lignes: LignePanier[]): number {
  return lignes.reduce((total, ligne) => total + ligne.prixCentimes * ligne.quantite, 0);
}

export function nombreArticles(lignes: LignePanier[]): number {
  return lignes.reduce((total, ligne) => total + ligne.quantite, 0);
}

function estLigne(valeur: unknown): valeur is LignePanier {
  if (typeof valeur !== 'object' || valeur === null) return false;
  const ligne = valeur as Record<string, unknown>;
  return (
    typeof ligne.productId === 'string' &&
    typeof ligne.nom === 'string' &&
    Number.isInteger(ligne.prixCentimes) &&
    typeof ligne.devise === 'string' &&
    Number.isInteger(ligne.quantite)
  );
}

/** Le panier (identifiants et quantités, aucune donnée personnelle) survit au rechargement et à la connexion. */
export function lirePanierStocke(stockage: Storage = sessionStorage): LignePanier[] {
  try {
    const brut: unknown = JSON.parse(stockage.getItem(CLE_STOCKAGE) ?? '[]');
    if (!Array.isArray(brut)) return [];
    return brut
      .filter(estLigne)
      .slice(0, LIGNES_MAX)
      .map((ligne) => ({ ...ligne, quantite: borner(ligne.quantite) }));
  } catch {
    return [];
  }
}

export function stockerPanier(lignes: LignePanier[], stockage: Storage = sessionStorage): void {
  try {
    stockage.setItem(CLE_STOCKAGE, JSON.stringify(lignes));
  } catch {
    // stockage indisponible (navigation privée stricte) : le panier reste en mémoire
  }
}
