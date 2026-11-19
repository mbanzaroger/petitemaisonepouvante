import { Suspense, useEffect, useEffectEvent, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { compterNonLues } from '../api/communaute';
import { estAdmin, estClient, estMembre, libelleProfil, useAuth } from '../auth/auth';
import { usePanier } from '../cart/contexte';
import { NOM_SITE } from '../hooks/useTitre';
import { ErreurInattendue } from './ErreurInattendue';
import { Chargement } from './Etats';

/** Relevé périodique des notifications non lues (et à chaque changement de page). */
const INTERVALLE_NOTIFICATIONS_MS = 30000;

function useNonLues(): number {
  const auth = useAuth();
  const { pathname } = useLocation();
  const membre = estMembre(auth);
  const [nonLues, setNonLues] = useState(0);
  const relever = useEffectEvent((signal: AbortSignal) =>
    compterNonLues(auth.jeton, signal).then(
      (compteur) => setNonLues(compteur.unread),
      () => undefined,
    ),
  );

  useEffect(() => {
    if (!membre) return;
    const controleur = new AbortController();
    void relever(controleur.signal);
    const minuterie = setInterval(() => void relever(controleur.signal), INTERVALLE_NOTIFICATIONS_MS);
    return () => {
      controleur.abort();
      clearInterval(minuterie);
    };
  }, [membre, pathname]);
  return membre ? nonLues : 0;
}

function CompteUtilisateur() {
  const auth = useAuth();
  const nonLues = useNonLues();
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
      {estMembre(auth) && (
        <Link to="/mon-espace" className="lien-espace">
          Mon espace
          {nonLues > 0 && (
            <>
              {' '}
              <span className="pastille" aria-hidden="true">
                {nonLues}
              </span>
              <span className="visuellement-masque">
                ({nonLues} notification{nonLues > 1 ? 's' : ''} non lue{nonLues > 1 ? 's' : ''})
              </span>
            </>
          )}
        </Link>
      )}
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
            <li>
              <NavLink to="/communaute" end>
                Troc et dons
              </NavLink>
            </li>
            <li>
              <NavLink to="/fanzine" end>
                Fanzine
              </NavLink>
            </li>
            <li>
              <NavLink to="/actualites" end>
                Actualités
              </NavLink>
            </li>
            {estMembre(auth) && (
              <li>
                <NavLink to="/communaute/salons">Salons</NavLink>
              </li>
            )}
            {estClient(auth) && (
              <li>
                <NavLink to="/commandes">Mes commandes</NavLink>
              </li>
            )}
            {estAdmin(auth) && (
              <>
                <li>
                  <NavLink to="/admin/stock">Stock</NavLink>
                </li>
                <li>
                  <NavLink to="/admin/moderation">Modération</NavLink>
                </li>
                <li>
                  <NavLink to="/admin/redaction">Rédaction</NavLink>
                </li>
              </>
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
