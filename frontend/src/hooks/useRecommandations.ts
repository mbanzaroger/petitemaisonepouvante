import { lireRecommandations, type Recommandations } from '../api/recommandations';
import { useAuth } from '../auth/auth';
import { useRessource, type Ressource } from './useRessource';

/** Recommandations de la page (personnalisées pour un membre consentant), exclusion éventuelle du produit affiché. */
export function useRecommandations(exclure?: string): Ressource<Recommandations> {
  const auth = useAuth();
  return useRessource(auth.pret ? `recommandations:${exclure ?? ''}:${auth.connecte}` : null, (signal) =>
    lireRecommandations(auth.connecte ? auth.jeton : undefined, exclure, signal),
  );
}
