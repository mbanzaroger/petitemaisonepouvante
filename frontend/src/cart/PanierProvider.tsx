import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Product } from '../api/types';
import { PanierContext, type Panier } from './contexte';
import {
  ajouterAuPanier,
  lirePanierStocke,
  modifierQuantite,
  nombreArticles,
  retirerDuPanier,
  stockerPanier,
  totalPanier,
  type LignePanier,
} from './panier';

export function PanierProvider({ children }: { children: ReactNode }) {
  const [lignes, setLignes] = useState<LignePanier[]>(() => lirePanierStocke());
  const lignesCourantes = useRef(lignes);

  useEffect(() => {
    lignesCourantes.current = lignes;
    stockerPanier(lignes);
  }, [lignes]);

  const ajouter = useCallback((produit: Product, quantite: number) => {
    const resultat = ajouterAuPanier(lignesCourantes.current, produit, quantite);
    lignesCourantes.current = resultat.lignes;
    setLignes(resultat.lignes);
    return resultat.message;
  }, []);

  const panier = useMemo<Panier>(
    () => ({
      lignes,
      nombreArticles: nombreArticles(lignes),
      totalCentimes: totalPanier(lignes),
      ajouter,
      modifierQuantite: (productId, quantite) => setLignes((courantes) => modifierQuantite(courantes, productId, quantite)),
      retirer: (productId) => setLignes((courantes) => retirerDuPanier(courantes, productId)),
      vider: () => setLignes([]),
    }),
    [lignes, ajouter],
  );

  return <PanierContext value={panier}>{children}</PanierContext>;
}
