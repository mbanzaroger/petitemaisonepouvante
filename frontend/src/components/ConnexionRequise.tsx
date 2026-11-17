import type { ReactNode } from 'react';
import { ROLE_CLIENT, aLeRole, useAuth, type Role } from '../auth/auth';
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

const TEXTES: Record<Role, { connexion: string; refus: string }> = {
  CUSTOMER: {
    connexion: 'Connectez-vous pour suivre vos commandes.',
    refus: "Votre compte n'a pas le profil client : les commandes ne sont pas accessibles.",
  },
  ADMIN: {
    connexion: "Connectez-vous avec un compte d'administration pour consulter le stock.",
    refus: "Cette page est réservée aux administrateurs de la boutique.",
  },
};

/**
 * Pages réservées à un rôle (CUSTOMER par défaut). Le site masque seulement l'accès : le Gateway et les services
 * vérifient eux aussi le jeton et le rôle (défense en profondeur).
 */
export function ConnexionRequise({ children, role = ROLE_CLIENT }: { children: ReactNode; role?: Role }) {
  const auth = useAuth();
  if (!auth.pret) return <Chargement texte="Vérification de la session…" />;
  if (!auth.connecte) {
    return (
      <Refus titre="Connexion requise">
        <p>{TEXTES[role].connexion}</p>
        <button type="button" className="bouton" onClick={auth.connecter}>
          Se connecter
        </button>
      </Refus>
    );
  }
  if (!aLeRole(auth, role)) {
    return (
      <Refus titre="Accès refusé">
        <p>{TEXTES[role].refus}</p>
      </Refus>
    );
  }
  return children;
}
