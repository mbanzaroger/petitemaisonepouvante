import type { ReactNode } from 'react';
import { estClient, useAuth } from '../auth/auth';
import { useTitre } from '../hooks/useTitre';
import { Chargement } from './Etats';

function Refus({ titre, children }: { titre: string; children: ReactNode }) {
  useTitre(titre);
  return (
    <section aria-labelledby="titre-page">
      <h1 id="titre-page" tabIndex={-1}>
        {titre}
      </h1>
      {children}
    </section>
  );
}

/** Pages réservées au rôle CUSTOMER (le Gateway et le service le vérifient aussi : défense en profondeur). */
export function ConnexionRequise({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (!auth.pret) return <Chargement texte="Vérification de la session…" />;
  if (!auth.connecte) {
    return (
      <Refus titre="Connexion requise">
        <p>Connectez-vous pour suivre vos commandes.</p>
        <button type="button" className="bouton" onClick={auth.connecter}>
          Se connecter
        </button>
      </Refus>
    );
  }
  if (!estClient(auth)) {
    return (
      <Refus titre="Accès refusé">
        <p>Votre compte n'a pas le profil client : les commandes ne sont pas accessibles.</p>
      </Refus>
    );
  }
  return children;
}
