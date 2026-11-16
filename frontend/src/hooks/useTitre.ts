import { useEffect } from 'react';

export const NOM_SITE = "La Petite Maison de l'Épouvante";

/** Titre de page unique et pertinent (RGAA 8.5 et 8.6), mis à jour à chaque navigation. */
export function useTitre(titre: string): void {
  useEffect(() => {
    document.title = `${titre} – ${NOM_SITE}`;
  }, [titre]);
}
