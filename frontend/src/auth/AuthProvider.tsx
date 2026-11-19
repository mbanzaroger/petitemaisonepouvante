import { useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { AuthContext, type Auth, type SourceAuth } from './auth';

export function AuthProvider({ source, children }: { source: SourceAuth; children: ReactNode }) {
  const etat = useSyncExternalStore(source.abonner, source.etat);
  const auth = useMemo<Auth>(
    () => ({
      ...etat,
      connecter: source.connecter,
      deconnecter: source.deconnecter,
      changerDeCompte: source.changerDeCompte,
      jeton: source.jeton,
    }),
    [etat, source],
  );
  return <AuthContext value={auth}>{children}</AuthContext>;
}
