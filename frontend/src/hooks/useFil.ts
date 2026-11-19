import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { versApiError, type ApiError } from '../api/client';
import type { Message } from '../api/communaute';

interface Etat {
  cle: string;
  messages: Message[];
  charge: boolean;
  erreur?: ApiError;
}

export interface Fil {
  messages: Message[];
  /** Premier chargement terminé (avec ou sans erreur). */
  charge: boolean;
  erreur?: ApiError;
  /** Ajoute tout de suite un message que l'on vient d'envoyer (sans attendre le prochain relevé). */
  ajouter(message: Message): void;
}

function fusionner(courant: Message[], nouveaux: Message[]): Message[] {
  const parId = new Map(courant.map((message) => [message.id, message]));
  nouveaux.forEach((message) => parId.set(message.id, message));
  return [...parId.values()].sort((a, b) => a.id - b.id);
}

/**
 * Fil de messages relevé périodiquement (ADR-005 : interrogation courte plutôt que connexion persistante).
 * Le curseur « après » ne demande que les nouveaux messages ; le relevé est suspendu quand l'onglet est masqué.
 */
export function useFil(
  cle: string | null,
  charger: (apres: number, signal: AbortSignal) => Promise<Message[]>,
  intervalleMs: number,
): Fil {
  const [etat, setEtat] = useState<Etat | null>(null);
  const dernier = useRef(0);
  const lancer = useEffectEvent((apres: number, signal: AbortSignal) => charger(apres, signal));

  useEffect(() => {
    if (cle === null) return;
    dernier.current = 0;
    const controleur = new AbortController();
    let minuterie: ReturnType<typeof setTimeout> | undefined;

    const relever = async () => {
      if (dernier.current === 0 || document.visibilityState !== 'hidden') {
        try {
          const nouveaux = await lancer(dernier.current, controleur.signal);
          if (controleur.signal.aborted) return;
          nouveaux.forEach((message) => {
            dernier.current = Math.max(dernier.current, message.id);
          });
          setEtat((courant) => ({
            cle,
            messages: fusionner(courant?.cle === cle ? courant.messages : [], nouveaux),
            charge: true,
          }));
        } catch (erreur) {
          if (controleur.signal.aborted) return;
          setEtat((courant) => ({
            cle,
            messages: courant?.cle === cle ? courant.messages : [],
            charge: true,
            erreur: versApiError(erreur),
          }));
        }
      }
      if (!controleur.signal.aborted) minuterie = setTimeout(() => void relever(), intervalleMs);
    };
    void relever();
    return () => {
      controleur.abort();
      clearTimeout(minuterie);
    };
  }, [cle, intervalleMs]);

  // Le curseur n'avance pas ici : un message d'un autre membre arrivé juste avant ne doit pas être sauté.
  const ajouter = useCallback(
    (message: Message) =>
      setEtat((courant) =>
        courant && courant.cle === cle ? { ...courant, messages: fusionner(courant.messages, [message]) } : courant,
      ),
    [cle],
  );

  const courant = etat !== null && etat.cle === cle ? etat : null;
  return { messages: courant?.messages ?? [], charge: courant?.charge ?? false, erreur: courant?.erreur, ajouter };
}
