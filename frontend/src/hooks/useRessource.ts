import { useCallback, useEffect, useEffectEvent, useState } from 'react';
import { versApiError, type ApiError } from '../api/client';

interface Etat<T> {
  cle: string;
  donnees?: T;
  erreur?: ApiError;
}

export interface Ressource<T> {
  donnees?: T;
  erreur?: ApiError;
  chargement: boolean;
  recharger(): void;
}

/**
 * Charge une ressource identifiée par « cle » (null : rien à charger) et la recharge quand la clé change.
 * Avec « conserver », les données précédentes restent affichées pendant un rechargement (suivi de commande).
 */
export function useRessource<T>(
  cle: string | null,
  charger: (signal: AbortSignal) => Promise<T>,
  { conserver = false }: { conserver?: boolean } = {},
): Ressource<T> {
  const [etat, setEtat] = useState<Etat<T> | null>(null);
  const [version, setVersion] = useState(0);
  const cleComplete = cle === null ? null : `${cle}#${version}`;
  const lancer = useEffectEvent((signal: AbortSignal) => charger(signal));

  useEffect(() => {
    if (cleComplete === null) return;
    const controleur = new AbortController();
    lancer(controleur.signal).then(
      (donnees) => {
        if (!controleur.signal.aborted) setEtat({ cle: cleComplete, donnees });
      },
      (erreur: unknown) => {
        if (!controleur.signal.aborted) setEtat({ cle: cleComplete, erreur: versApiError(erreur) });
      },
    );
    return () => controleur.abort();
  }, [cleComplete]);

  const recharger = useCallback(() => setVersion((v) => v + 1), []);
  const courant = etat !== null && etat.cle === cleComplete ? etat : null;
  const precedent = conserver && etat !== null && cle !== null && etat.cle.startsWith(`${cle}#`) ? etat : null;
  return {
    donnees: courant?.donnees ?? (courant ? undefined : precedent?.donnees),
    erreur: courant?.erreur,
    chargement: cleComplete !== null && courant === null,
    recharger,
  };
}
