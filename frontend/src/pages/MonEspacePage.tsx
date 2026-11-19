import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { versApiError, type ApiError } from '../api/client';
import {
  STATUTS_ANNONCE,
  TYPES,
  ajouterRecherche,
  enregistrerPreferences,
  lirePreferences,
  listerNotifications,
  listerRecherches,
  mesAnnonces,
  supprimerRecherche,
  toutMarquerLu,
  type Preferences,
} from '../api/communaute';
import { effacerHistorique, enregistrerPersonnalisation, lirePersonnalisation } from '../api/recommandations';
import { estClient, libelleProfil, useAuth } from '../auth/auth';
import { Chargement, MessageErreur } from '../components/Etats';
import { formaterDate } from '../format';
import { useRessource } from '../hooks/useRessource';
import { useTitre } from '../hooks/useTitre';

function Notifications() {
  const auth = useAuth();
  const notifications = useRessource('notifications', (signal) => listerNotifications(auth.jeton, signal));
  const [erreur, setErreur] = useState<ApiError>();
  const nonLues = notifications.donnees?.filter((notification) => !notification.read).length ?? 0;

  async function toutLire() {
    setErreur(undefined);
    try {
      await toutMarquerLu(auth.jeton);
      notifications.recharger();
    } catch (e) {
      setErreur(versApiError(e));
    }
  }

  return (
    <section aria-labelledby="titre-notifications">
      <h2 id="titre-notifications">Notifications</h2>
      {notifications.chargement && <Chargement texte="Chargement des notifications…" />}
      {notifications.erreur && <MessageErreur erreur={notifications.erreur} onReessayer={notifications.recharger} />}
      {erreur && <MessageErreur erreur={erreur} />}
      {notifications.donnees && notifications.donnees.length === 0 && <p>Aucune notification.</p>}
      {notifications.donnees && notifications.donnees.length > 0 && (
        <>
          <p role="status">
            {nonLues === 0 ? 'Toutes vos notifications sont lues.' : `${nonLues} notification${nonLues > 1 ? 's' : ''} non lue${nonLues > 1 ? 's' : ''}.`}
          </p>
          <ul className="notifications">
            {notifications.donnees.map((notification) => (
              <li key={notification.id} className={notification.read ? 'notification' : 'notification notification-non-lue'}>
                {!notification.read && <span className="etiquette">Nouveau</span>}{' '}
                <Link to={notification.link}>{notification.text}</Link>{' '}
                <span className="note">{formaterDate(notification.createdAt)}</span>
              </li>
            ))}
          </ul>
          {nonLues > 0 && (
            <button type="button" className="bouton bouton-secondaire" onClick={() => void toutLire()}>
              Tout marquer comme lu
            </button>
          )}
        </>
      )}
    </section>
  );
}

const LIBELLES_PREFERENCES: Record<keyof Preferences, string> = {
  offers: 'Propositions reçues et réponses à mes propositions',
  messages: 'Nouveaux messages dans mes conversations',
  wishes: 'Nouvelles annonces correspondant à mes recherches',
  browsing: 'Nouvelles annonces dans les catégories que je consulte souvent (mes consultations sont alors enregistrées)',
};

function FormulairePreferences({ initiales }: { initiales: Preferences }) {
  const auth = useAuth();
  const [annonce, setAnnonce] = useState('');
  const [erreur, setErreur] = useState<ApiError>();

  async function enregistrer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const donnees = new FormData(evenement.currentTarget);
    setAnnonce('');
    setErreur(undefined);
    try {
      await enregistrerPreferences(
        {
          offers: donnees.has('offers'),
          messages: donnees.has('messages'),
          wishes: donnees.has('wishes'),
          browsing: donnees.has('browsing'),
        },
        auth.jeton,
      );
      setAnnonce('Préférences enregistrées.');
    } catch (e) {
      setErreur(versApiError(e));
    }
  }

  return (
    <form className="formulaire" onSubmit={(e) => void enregistrer(e)}>
      {erreur && <MessageErreur erreur={erreur} />}
      <fieldset>
        <legend>Me prévenir pour :</legend>
        {(Object.keys(LIBELLES_PREFERENCES) as (keyof Preferences)[]).map((cle) => (
          <label key={cle} className="case">
            <input type="checkbox" name={cle} defaultChecked={initiales[cle]} /> {LIBELLES_PREFERENCES[cle]}
          </label>
        ))}
      </fieldset>
      <p className="note">
        Les décisions de la modération vous sont toujours notifiées. Les catégories consultées ne sont enregistrées
        qu'avec votre accord, conservées 180 jours et effacées si vous décochez la dernière case.
      </p>
      <div className="actions">
        <button type="submit" className="bouton">
          Enregistrer les préférences
        </button>
      </div>
      <p role="status">{annonce}</p>
    </form>
  );
}

function PreferencesNotification() {
  const auth = useAuth();
  const preferences = useRessource('preferences', (signal) => lirePreferences(auth.jeton, signal));
  return (
    <section aria-labelledby="titre-preferences">
      <h2 id="titre-preferences">Préférences de notification</h2>
      {preferences.chargement && <Chargement texte="Chargement des préférences…" />}
      {preferences.erreur && <MessageErreur erreur={preferences.erreur} onReessayer={preferences.recharger} />}
      {preferences.donnees && <FormulairePreferences initiales={preferences.donnees} />}
    </section>
  );
}

function Personnalisation() {
  const auth = useAuth();
  const preference = useRessource('personnalisation', (signal) => lirePersonnalisation(auth.jeton, signal));
  const [annonce, setAnnonce] = useState('');
  const [erreur, setErreur] = useState<ApiError>();

  async function executer(action: () => Promise<unknown>, message: string) {
    setAnnonce('');
    setErreur(undefined);
    try {
      await action();
      setAnnonce(message);
    } catch (e) {
      setErreur(versApiError(e));
    }
  }

  function enregistrer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const active = new FormData(evenement.currentTarget).has('personnalisation');
    void executer(
      () => enregistrerPersonnalisation(active, auth.jeton),
      active ? 'Recommandations personnalisées activées.' : 'Recommandations personnalisées désactivées ; historique effacé.',
    );
  }

  return (
    <section aria-labelledby="titre-personnalisation">
      <h2 id="titre-personnalisation">Recommandations</h2>
      <p>
        Avec votre accord, les produits consultés, les catégories recherchées et vos achats servent à vous recommander
        des produits. Désactivé par défaut ; historique conservé 90 jours, jamais transmis à des tiers.
      </p>
      {erreur && <MessageErreur erreur={erreur} />}
      {preference.erreur && <MessageErreur erreur={preference.erreur} onReessayer={preference.recharger} />}
      {preference.donnees && (
        <form className="formulaire" onSubmit={enregistrer}>
          <label className="case">
            <input type="checkbox" name="personnalisation" defaultChecked={preference.donnees.personalized} />
            Personnaliser les recommandations selon ma navigation et mes achats
          </label>
          <div className="actions">
            <button type="submit" className="bouton">
              Enregistrer mon choix
            </button>
            <button
              type="button"
              className="bouton bouton-secondaire"
              onClick={() => void executer(() => effacerHistorique(auth.jeton), 'Historique de navigation effacé.')}
            >
              Effacer mon historique
            </button>
          </div>
        </form>
      )}
      <p role="status">{annonce}</p>
    </section>
  );
}

function Recherches() {
  const auth = useAuth();
  const recherches = useRessource('recherches', (signal) => listerRecherches(auth.jeton, signal));
  const [annonce, setAnnonce] = useState('');
  const [erreur, setErreur] = useState<ApiError>();

  async function ajouter(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const formulaire = evenement.currentTarget;
    const motsCles = String(new FormData(formulaire).get('motsCles') ?? '').trim();
    setErreur(undefined);
    try {
      await ajouterRecherche(motsCles, auth.jeton);
      formulaire.reset();
      setAnnonce(`Recherche « ${motsCles} » ajoutée.`);
      recherches.recharger();
    } catch (e) {
      setErreur(versApiError(e));
    }
  }

  async function supprimer(id: string, motsCles: string) {
    setErreur(undefined);
    try {
      await supprimerRecherche(id, auth.jeton);
      setAnnonce(`Recherche « ${motsCles} » supprimée.`);
      recherches.recharger();
    } catch (e) {
      setErreur(versApiError(e));
    }
  }

  return (
    <section aria-labelledby="titre-recherches">
      <h2 id="titre-recherches">Objets recherchés</h2>
      <p>Vous êtes prévenu dès qu'une annonce correspondant à l'une de vos recherches est publiée (10 au plus).</p>
      <p role="status">{annonce}</p>
      {erreur && <MessageErreur erreur={erreur} />}
      {recherches.erreur && <MessageErreur erreur={recherches.erreur} onReessayer={recherches.recharger} />}
      {recherches.donnees && recherches.donnees.length > 0 && (
        <ul className="recherches">
          {recherches.donnees.map((recherche) => (
            <li key={recherche.id}>
              {recherche.keywords}{' '}
              <button
                type="button"
                className="bouton bouton-lien"
                onClick={() => void supprimer(recherche.id, recherche.keywords)}
              >
                Supprimer <span className="visuellement-masque">la recherche « {recherche.keywords} »</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="filtres" onSubmit={(e) => void ajouter(e)}>
        <label htmlFor="recherche-mots-cles">Objet recherché</label>
        <input id="recherche-mots-cles" name="motsCles" required minLength={2} maxLength={60} autoComplete="off" />
        <button type="submit" className="bouton bouton-secondaire">
          Ajouter
        </button>
      </form>
    </section>
  );
}

function MesAnnonces() {
  const auth = useAuth();
  const annonces = useRessource('mes-annonces', (signal) => mesAnnonces(auth.jeton, signal));
  return (
    <section aria-labelledby="titre-mes-annonces">
      <h2 id="titre-mes-annonces">Mes annonces</h2>
      {annonces.erreur && <MessageErreur erreur={annonces.erreur} onReessayer={annonces.recharger} />}
      {annonces.donnees && annonces.donnees.length === 0 && (
        <p>
          Aucune annonce. <Link to="/communaute/publier">Publier une annonce</Link>
        </p>
      )}
      {annonces.donnees && annonces.donnees.length > 0 && (
        <ul>
          {annonces.donnees.map((annonce) => (
            <li key={annonce.id}>
              <Link to={`/communaute/annonces/${annonce.id}`}>{annonce.title}</Link> ({TYPES[annonce.type]},{' '}
              {STATUTS_ANNONCE[annonce.status].toLowerCase()})
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** US11 — espace personnel : compte, notifications, préférences de notification, objets recherchés, annonces. */
export function MonEspacePage() {
  useTitre('Mon espace');
  const auth = useAuth();
  return (
    <>
      <h1 tabIndex={-1}>Mon espace</h1>
      <p>
        Connecté avec le compte <strong>{auth.utilisateur}</strong> (profil : {libelleProfil(auth).toLowerCase()}).
      </p>
      <ul className="liens-rapides">
        {estClient(auth) && (
          <li>
            <Link to="/commandes">Mes commandes</Link>
          </li>
        )}
        <li>
          <Link to="/communaute/propositions">Mes propositions de troc</Link>
        </li>
        <li>
          <Link to="/communaute/salons">Salons de discussion</Link>
        </li>
      </ul>
      <Notifications />
      <PreferencesNotification />
      <Personnalisation />
      <Recherches />
      <MesAnnonces />
    </>
  );
}
