import { Suspense, useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { estAdmin, estClient, libelleProfil, useAuth } from '../auth/auth';
import { usePanier } from '../cart/contexte';
import { NOM_SITE } from '../hooks/useTitre';
import { ErreurInattendue } from './ErreurInattendue';
import { Chargement } from './Etats';

function CompteUtilisateur() {
  const auth = useAuth();
  if (!auth.pret) return null;
  if (!auth.connecte) {
    return (
      <button type="button" className="bouton bouton-secondaire" onClick={auth.connecter}>
        Se connecter
      </button>
    );
  }
  const nom = auth.utilisateur ?? 'utilisateur';
  return (
    <>
      <p className="identite">
        <span className="avatar" aria-hidden="true">
          {nom.charAt(0).toUpperCase()}
        </span>
        <span>
          Connecté :{' '}
          <strong className="identite-nom">{nom}</strong>{' '}
          <span className="identite-profil">{libelleProfil(auth)}</span>
        </span>
      </p>
      <button type="button" className="bouton bouton-secondaire" onClick={auth.deconnecter}>
        Se déconnecter
      </button>
    </>
  );
}

function focaliserTitre(): (() => void) | undefined {
  const principal = document.getElementById('contenu');
  const titre = principal?.querySelector<HTMLElement>('h1');
  if (!principal || titre) {
    titre?.focus();
    return undefined;
  }
  const observateur = new MutationObserver(() => {
    const apparu = principal.querySelector<HTMLElement>('h1');
    if (apparu) {
      apparu.focus();
      observateur.disconnect();
    }
  });
  observateur.observe(principal, { childList: true, subtree: true });
  const delai = setTimeout(() => observateur.disconnect(), 3000);
  return () => {
    observateur.disconnect();
    clearTimeout(delai);
  };
}

export function Layout() {
  const auth = useAuth();
  const { nombreArticles } = usePanier();
  const { pathname } = useLocation();
  const premierAffichage = useRef(true);

  // Navigation sans rechargement : le focus est placé sur le titre de la nouvelle page (lecteurs d'écran, clavier).
  // Une page chargée à la demande n'a pas encore de titre : on attend son apparition (3 s au plus).
  useEffect(() => {
    if (premierAffichage.current) {
      premierAffichage.current = false;
      return;
    }
    return focaliserTitre();
  }, [pathname]);

  return (
    <>
      <a className="lien-evitement" href="#contenu">
        Aller au contenu
      </a>
      <header className="entete">
        <p className="marque">
          <Link to="/">{NOM_SITE}</Link>
        </p>
        <nav aria-label="Navigation principale" className="navigation">
          <ul>
            <li>
              <NavLink to="/" end>
                Catalogue
              </NavLink>
            </li>
            <li>
              <NavLink to="/panier">
                Panier <span className="pastille" aria-hidden="true">{nombreArticles}</span>
                <span className="visuellement-masque">
                  {' '}
                  ({nombreArticles} article{nombreArticles > 1 ? 's' : ''})
                </span>
              </NavLink>
            </li>
            {estClient(auth) && (
              <li>
                <NavLink to="/commandes">Mes commandes</NavLink>
              </li>
            )}
            {estAdmin(auth) && (
              <li>
                <NavLink to="/admin/stock">Stock</NavLink>
              </li>
            )}
          </ul>
        </nav>
        <div className="compte">
          <CompteUtilisateur />
        </div>
      </header>
      <main id="contenu" tabIndex={-1}>
        {auth.echecConnexion && !auth.connecte && (
          <div role="alert" className="alerte alerte-erreur">
            <p>
              La connexion n'a pas pu être établie : le service d'authentification ne répond pas. Vous pouvez continuer
              à parcourir le catalogue et réessayer de vous connecter dans un instant.
            </p>
          </div>
        )}
        <ErreurInattendue key={pathname}>
          <Suspense fallback={<Chargement texte="Chargement de la page…" />}>
            <Outlet />
          </Suspense>
        </ErreurInattendue>
      </main>
      <footer className="pied">
        <nav aria-label="Informations sur le site">
          <ul>
            <li>
              <Link to="/plan-du-site">Plan du site</Link>
            </li>
            <li>
              <Link to="/accessibilite">Accessibilité : non conforme</Link>
            </li>
            <li>
              <Link to="/mentions-legales">Mentions légales</Link>
            </li>
            <li>
              <Link to="/donnees-personnelles">Données personnelles et cookies</Link>
            </li>
          </ul>
        </nav>
        <p>Démonstrateur du projet de refonte : données fictives, aucun paiement réel.</p>
      </footer>
    </>
  );
}
