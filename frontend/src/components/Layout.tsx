import { Suspense, useEffect, useEffectEvent, useRef, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router';
import { listerCategories } from '../api/catalogue';
import { compterNonLues } from '../api/communaute';
import { estAdmin, estClient, estMembre, libelleProfil, useAuth } from '../auth/auth';
import { usePanier } from '../cart/contexte';
import { useRessource } from '../hooks/useRessource';
import { NOM_SITE } from '../hooks/useTitre';
import { ErreurInattendue } from './ErreurInattendue';
import { Chargement } from './Etats';
import {
  IconeCompte,
  IconeEtoile,
  IconeMaison,
  IconeMenu,
  IconePanier,
  IconeRayon,
  IconeRecherche,
  Logo,
} from './Icones';
import { RayonsContexte } from './rayons';

const AUCUN_RAYON: string[] = [];

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
      <>
        <span className="compte-icone" aria-hidden="true">
          <IconeCompte taille={26} />
        </span>
        <span className="compte-actions">
          <button type="button" className="bouton bouton-clair" onClick={auth.connecter}>
            Se connecter
          </button>
          <button type="button" className="bouton-lien" onClick={auth.inscrire}>
            Créer un compte
          </button>
        </span>
      </>
    );
  }
  const nom = auth.utilisateur ?? 'utilisateur';
  return (
    <>
      <p className="identite">
        <span className="avatar" aria-hidden="true">
          {nom.charAt(0).toUpperCase()}
        </span>
        <span className="identite-texte">
          <span className="identite-libelle">Connecté :</span>{' '}
          <strong className="identite-nom">{nom}</strong>{' '}
          <span className="identite-profil">{libelleProfil(auth)}</span>
        </span>
      </p>
      <span className="compte-actions">
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
        <button type="button" className="bouton-lien" onClick={auth.deconnecter}>
          Se déconnecter
        </button>
      </span>
    </>
  );
}

/** Recherche dans le catalogue (US22) : rayon et texte, résultats affichés par le catalogue. */
function RechercheProduits({ rayons }: { rayons: string[] }) {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const naviguer = useNavigate();
  const surCatalogue = pathname === '/';
  const rayon = surCatalogue ? (params.get('categorie') ?? '') : '';
  const texte = surCatalogue ? (params.get('q') ?? '') : '';

  function chercher(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const donnees = new FormData(evenement.currentTarget);
    const suivants = new URLSearchParams();
    const saisie = String(donnees.get('q') ?? '').trim();
    const choix = String(donnees.get('rayon') ?? '');
    if (saisie) suivants.set('q', saisie);
    if (choix) suivants.set('categorie', choix);
    const requete = suivants.toString();
    void naviguer(requete ? `/?${requete}` : '/');
  }

  return (
    <form role="search" className="recherche" aria-label="Rechercher dans la boutique" onSubmit={chercher}>
      <label htmlFor="recherche-rayon" className="visuellement-masque">
        Rayon
      </label>
      <select id="recherche-rayon" name="rayon" defaultValue={rayon} key={`rayon-${rayon}`}>
        <option value="">Tous les rayons</option>
        {rayons.map((nom) => (
          <option key={nom} value={nom}>
            {nom}
          </option>
        ))}
      </select>
      <label htmlFor="recherche-texte" className="visuellement-masque">
        Rechercher un produit
      </label>
      <input
        id="recherche-texte"
        type="search"
        name="q"
        maxLength={100}
        placeholder="Figurine, Blu-ray, référence…"
        defaultValue={texte}
        key={`texte-${texte}`}
      />
      <button type="submit" className="recherche-bouton">
        <IconeRecherche taille={22} />
        <span className="visuellement-masque">Lancer la recherche</span>
      </button>
    </form>
  );
}

/** Menu « Toutes les catégories » : bouton qui déplie la liste des rayons (motif de divulgation). */
function MenuRayons({ rayons }: { rayons: string[] }) {
  const [ouvert, setOuvert] = useState(false);
  const conteneur = useRef<HTMLDivElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const fermer = () => setOuvert(false);

  useEffect(() => {
    if (!ouvert) return;
    function touche(evenement: KeyboardEvent) {
      if (evenement.key === 'Escape') {
        setOuvert(false);
        bouton.current?.focus();
      }
    }
    function clic(evenement: MouseEvent) {
      if (!conteneur.current?.contains(evenement.target as Node)) setOuvert(false);
    }
    document.addEventListener('keydown', touche);
    document.addEventListener('mousedown', clic);
    return () => {
      document.removeEventListener('keydown', touche);
      document.removeEventListener('mousedown', clic);
    };
  }, [ouvert]);

  return (
    <div className="rayons" ref={conteneur}>
      <button
        ref={bouton}
        type="button"
        className="bouton-rayons"
        aria-expanded={ouvert}
        aria-controls="menu-rayons"
        onClick={() => setOuvert((valeur) => !valeur)}
      >
        <IconeMenu />
        Toutes les catégories
      </button>
      <ul id="menu-rayons" className="menu-rayons" hidden={!ouvert}>
        <li>
          <Link to="/" onClick={fermer}>
            <IconeMaison />
            Tout le catalogue
          </Link>
        </li>
        {rayons.map((nom) => (
          <li key={nom}>
            <Link to={`/?categorie=${encodeURIComponent(nom)}`} onClick={fermer}>
              <IconeRayon rayon={nom} />
              {nom}
            </Link>
          </li>
        ))}
        <li>
          <Link to="/?exclusif=1" onClick={fermer}>
            <IconeEtoile />
            Exclusivités Evil Ed
          </Link>
        </li>
      </ul>
    </div>
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
  const rayons = useRessource('rayons', listerCategories).donnees ?? AUCUN_RAYON;

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
    <RayonsContexte value={rayons}>
      <a className="lien-evitement" href="#contenu">
        Aller au contenu
      </a>
      <header className="entete">
        <div className="bandeau">
          <div className="conteneur bandeau-contenu">
            <p>Le lieu de rêve pour frissonner</p>
            <p className="bandeau-magasins">Nos magasins : Angoulême · Aix-en-Provence · Lyon · Londres</p>
          </div>
        </div>
        <div className="conteneur entete-principale">
          <p className="marque">
            <Link to="/">
              <Logo />
              <span className="marque-texte">
                <span className="marque-nom">La Petite Maison</span>{' '}
                <span className="marque-suite">de l'Épouvante</span>
              </span>
            </Link>
          </p>
          <RechercheProduits rayons={rayons} />
          <div className="compte">
            <CompteUtilisateur />
          </div>
          <NavLink to="/panier" className="lien-panier">
            <span className="lien-panier-icone">
              <IconePanier taille={28} />
              <span className="pastille" aria-hidden="true">
                {nombreArticles}
              </span>
            </span>
            <span className="lien-panier-texte">Panier</span>
            <span className="visuellement-masque">
              {' '}
              ({nombreArticles} article{nombreArticles > 1 ? 's' : ''})
            </span>
          </NavLink>
        </div>
        <nav aria-label="Navigation principale" className="barre-navigation">
          <div className="conteneur barre-navigation-contenu">
            <MenuRayons rayons={rayons} />
            <ul className="navigation">
              <li>
                <NavLink to="/" end>
                  Catalogue
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
            </ul>
            <Link to="/?exclusif=1" className="lien-promo">
              <IconeEtoile />
              Exclusivités Evil Ed
            </Link>
          </div>
          {estAdmin(auth) && (
            <div className="barre-admin">
              <div className="conteneur barre-admin-contenu">
                <p className="barre-admin-titre">Administration</p>
                <ul className="navigation">
                  <li>
                    <NavLink to="/admin/stock">Produits et stock</NavLink>
                  </li>
                  <li>
                    <NavLink to="/admin/commandes">Commandes clients</NavLink>
                  </li>
                  <li>
                    <NavLink to="/admin/moderation">Modération</NavLink>
                  </li>
                  <li>
                    <NavLink to="/admin/redaction">Rédaction</NavLink>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </nav>
      </header>
      <main id="contenu" tabIndex={-1} className="conteneur">
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
        <div className="conteneur pied-colonnes">
          <section className="pied-bloc pied-apropos" aria-labelledby="pied-apropos">
            <h2 id="pied-apropos">À propos</h2>
            <p>
              Fondée par cinq passionnés du genre horrifique, La Petite Maison de l'Épouvante édite un fanzine,
              organise chaque année le Petit Festival de l'Épouvante et accompagne le collectif de production Evil Ed.
            </p>
          </section>
          <nav className="pied-bloc" aria-labelledby="pied-boutique">
            <h2 id="pied-boutique">La boutique</h2>
            <ul>
              <li>
                <Link to="/">Tout le catalogue</Link>
              </li>
              <li>
                <Link to="/?tri=nouveautes">Nouveautés</Link>
              </li>
              <li>
                <Link to="/?exclusif=1">Gamme exclusive Evil Ed</Link>
              </li>
              <li>
                <Link to="/fanzine/abonnement">Abonnement au fanzine</Link>
              </li>
            </ul>
          </nav>
          <nav className="pied-bloc" aria-labelledby="pied-communaute">
            <h2 id="pied-communaute">Communauté</h2>
            <ul>
              <li>
                <Link to="/communaute">Annonces de troc et de dons</Link>
              </li>
              <li>
                <Link to="/actualites">Actualités et dossiers de la rédaction</Link>
              </li>
            </ul>
          </nav>
          <nav className="pied-bloc" aria-label="Informations sur le site">
            <h2>Informations</h2>
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
          <section className="pied-bloc" aria-labelledby="pied-magasins">
            <h2 id="pied-magasins">Nos magasins</h2>
            <ul>
              <li>Angoulême</li>
              <li>Aix-en-Provence</li>
              <li>Lyon</li>
              <li>
                Londres : <span lang="en">The Little House of Thrill</span>
              </li>
            </ul>
          </section>
        </div>
        <div className="pied-bas">
          <p className="conteneur">
            © 2026 {NOM_SITE}. Démonstrateur du projet de refonte : données fictives, aucun paiement réel.
          </p>
        </div>
      </footer>
    </RayonsContexte>
  );
}
