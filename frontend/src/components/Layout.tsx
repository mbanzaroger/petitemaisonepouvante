import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useAuth } from '../auth/auth';
import { usePanier } from '../cart/contexte';
import { NOM_SITE } from '../hooks/useTitre';

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
  return (
    <>
      <span className="utilisateur">Bonjour {auth.utilisateur}</span>
      <button type="button" className="bouton bouton-secondaire" onClick={auth.deconnecter}>
        Se déconnecter
      </button>
    </>
  );
}

export function Layout() {
  const auth = useAuth();
  const { nombreArticles } = usePanier();
  const { pathname } = useLocation();
  const premierAffichage = useRef(true);

  // Navigation sans rechargement : le focus est placé sur le titre de la nouvelle page (lecteurs d'écran, clavier).
  useEffect(() => {
    if (premierAffichage.current) {
      premierAffichage.current = false;
      return;
    }
    document.querySelector<HTMLElement>('main h1')?.focus();
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
            {auth.connecte && (
              <li>
                <NavLink to="/commandes">Mes commandes</NavLink>
              </li>
            )}
          </ul>
        </nav>
        <div className="compte">
          <CompteUtilisateur />
        </div>
      </header>
      <main id="contenu" tabIndex={-1}>
        <Outlet />
      </main>
      <footer className="pied">
        <p>Démonstrateur du projet de refonte : données fictives, aucun paiement réel.</p>
      </footer>
    </>
  );
}
