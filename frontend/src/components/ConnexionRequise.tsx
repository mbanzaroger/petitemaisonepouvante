import type { ReactNode } from 'react';
import { ACCES_MEMBRE, ROLE_ADMIN, ROLE_CLIENT, aLeRole, estMembre, useAuth, type Role } from '../auth/auth';
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

/** Accès exigé : un rôle précis, ou « MEMBRE » (client ou administrateur) pour l'espace communautaire. */
export type Acces = Role | typeof ACCES_MEMBRE;

const TEXTES: Record<Acces, { connexion: string; refus: string }> = {
  CUSTOMER: {
    connexion: 'Connectez-vous pour suivre vos commandes.',
    refus: "Votre compte n'a pas le profil client : les commandes ne sont pas accessibles.",
  },
  ADMIN: {
    connexion: "Connectez-vous avec un compte d'administration pour accéder à cette page.",
    refus: 'Cette page est réservée aux administrateurs de la boutique.',
  },
  MEMBRE: {
    connexion: "Connectez-vous pour accéder à l'espace communautaire.",
    refus: "Votre compte n'a pas le profil client : l'espace communautaire ne lui est pas ouvert.",
  },
};

/**
 * Pages réservées à un rôle (CUSTOMER par défaut). Le site masque seulement l'accès : le Gateway et les services
 * vérifient eux aussi le jeton et le rôle (défense en profondeur).
 */
export function ConnexionRequise({ children, role = ROLE_CLIENT }: { children: ReactNode; role?: Acces }) {
  const auth = useAuth();
  if (!auth.pret) return <Chargement texte="Vérification de la session…" />;
  if (!auth.connecte) {
    return (
      <Refus titre="Connexion requise">
        <p>{TEXTES[role].connexion}</p>
        <div className="actions">
          <button type="button" className="bouton" onClick={auth.connecter}>
            Se connecter
          </button>
          {role !== ROLE_ADMIN && (
            <button type="button" className="bouton bouton-secondaire" onClick={auth.inscrire}>
              Créer un compte client
            </button>
          )}
        </div>
      </Refus>
    );
  }
  if (role === ACCES_MEMBRE ? !estMembre(auth) : !aLeRole(auth, role)) {
    return (
      <Refus titre="Accès refusé">
        <p>
          Vous êtes connecté avec le compte « {auth.utilisateur} ». {TEXTES[role].refus}
        </p>
        <button type="button" className="bouton" onClick={auth.changerDeCompte}>
          Changer de compte
        </button>
      </Refus>
    );
  }
  return children;
}
