import { useId, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { versApiError, type ApiError } from '../../api/client';
import {
  CATEGORIES,
  ETATS,
  STATUTS_ANNONCE,
  TYPES,
  lireAnnonce,
  proposer,
  retirerAnnonce,
  type Annonce,
} from '../../api/communaute';
import { estMembre, useAuth } from '../../auth/auth';
import { Chargement, MessageErreur } from '../../components/Etats';
import { Signaler } from '../../components/communaute/Signaler';
import { formaterDate } from '../../format';
import { useRessource } from '../../hooks/useRessource';
import { useTitre } from '../../hooks/useTitre';

function Proposer({ annonce }: { annonce: Annonce }) {
  const auth = useAuth();
  const naviguer = useNavigate();
  const idMessage = useId();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<ApiError>();
  const don = annonce.type === 'GIFT';

  async function envoyer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const message = String(new FormData(evenement.currentTarget).get('message') ?? '').trim();
    setEnvoi(true);
    setErreur(undefined);
    try {
      const proposition = await proposer(annonce.id, message, auth.jeton);
      void naviguer(`/communaute/propositions/${proposition.id}`, { state: { nouvelle: true } });
    } catch (e) {
      setErreur(versApiError(e));
      setEnvoi(false);
    }
  }

  return (
    <form className="formulaire" onSubmit={(e) => void envoyer(e)}>
      <h2>{don ? 'Demander ce don' : 'Proposer un échange'}</h2>
      {erreur && <MessageErreur erreur={erreur} />}
      <label htmlFor={idMessage}>
        Votre message à {annonce.ownerName}
        <span className="note">
          {' '}
          {don ? '(pourquoi cet objet vous intéresse, quand vous pouvez le récupérer)' : '(objet proposé en échange, disponibilités)'}
        </span>
      </label>
      <textarea id={idMessage} name="message" required minLength={2} maxLength={1000} rows={4} />
      <div className="actions">
        <button type="submit" className="bouton bouton-principal" disabled={envoi}>
          {envoi ? 'Envoi…' : 'Envoyer la proposition'}
        </button>
      </div>
    </form>
  );
}

function Actions({ annonce, recharger }: { annonce: Annonce; recharger: () => void }) {
  const auth = useAuth();
  const [erreur, setErreur] = useState<ApiError>();
  const [retrait, setRetrait] = useState(false);

  async function retirer() {
    setErreur(undefined);
    try {
      await retirerAnnonce(annonce.id, auth.jeton);
      setRetrait(true);
      recharger();
    } catch (e) {
      setErreur(versApiError(e));
    }
  }

  if (!auth.pret) return null;
  if (!auth.connecte) {
    return (
      <div className="commande-action">
        <p>Connectez-vous pour faire une proposition à l'auteur de cette annonce.</p>
        <button type="button" className="bouton" onClick={auth.connecter}>
          Se connecter
        </button>
      </div>
    );
  }
  if (annonce.mine) {
    return (
      <div className="commande-action">
        <p role="status">{retrait ? 'Votre annonce est retirée : elle n’apparaît plus dans les annonces.' : ''}</p>
        {erreur && <MessageErreur erreur={erreur} />}
        <p>
          <Link to="/communaute/propositions">Voir les propositions reçues</Link>
        </p>
        {annonce.status === 'ACTIVE' && (
          <button type="button" className="bouton bouton-secondaire" onClick={() => void retirer()}>
            Retirer l'annonce
          </button>
        )}
      </div>
    );
  }
  if (!estMembre(auth)) {
    return (
      <div role="alert" className="alerte">
        <p>Votre compte n'a pas le profil client : il ne peut pas faire de proposition.</p>
        <button type="button" className="bouton bouton-secondaire" onClick={auth.changerDeCompte}>
          Changer de compte
        </button>
      </div>
    );
  }
  if (annonce.status !== 'ACTIVE') {
    return <p className="note">Cette annonce n'est plus disponible.</p>;
  }
  return <Proposer annonce={annonce} />;
}

/** US8, US9 — détail d'une annonce, proposition d'échange ou demande de don, retrait par l'auteur, signalement. */
export function AnnoncePage() {
  const { id = '' } = useParams();
  const auth = useAuth();
  const { state } = useLocation() as { state: { publiee?: boolean } | null };
  // Données conservées pendant un rechargement (après un retrait) : le message de confirmation reste affiché.
  const annonce = useRessource(
    auth.pret ? `annonce:${id}:${auth.connecte}` : null,
    (signal) => lireAnnonce(id, auth.connecte ? auth.jeton : undefined, signal),
    { conserver: true },
  );
  useTitre(annonce.donnees ? annonce.donnees.title : 'Annonce');

  if (annonce.erreur) {
    return (
      <>
        <h1 tabIndex={-1}>{annonce.erreur.status === 404 ? 'Annonce introuvable' : 'Annonce'}</h1>
        <MessageErreur erreur={annonce.erreur} onReessayer={annonce.erreur.status === 404 ? undefined : annonce.recharger} />
        <p>
          <Link to="/communaute">Retour aux annonces</Link>
        </p>
      </>
    );
  }
  if (!annonce.donnees) return <Chargement texte="Chargement de l'annonce…" />;
  const a = annonce.donnees;
  return (
    <article className="fiche-produit">
      <p className="fil">
        <Link to="/communaute">Troc et dons</Link>
      </p>
      <h1 tabIndex={-1}>{a.title}</h1>
      {state?.publiee && (
        <div role="status" className="alerte alerte-succes">
          <p>Votre annonce est publiée. Les membres qui recherchent un objet semblable sont prévenus.</p>
        </div>
      )}
      <p>
        <span className={`etiquette etiquette-${a.type.toLowerCase()}`}>{TYPES[a.type]}</span>{' '}
        <span className="statut">{STATUTS_ANNONCE[a.status]}</span>
      </p>
      <dl className="caracteristiques">
        <dt>Catégorie</dt>
        <dd>{CATEGORIES[a.category]}</dd>
        <dt>État</dt>
        <dd>{ETATS[a.condition]}</dd>
        <dt>Proposée par</dt>
        <dd>{a.mine ? 'vous' : a.ownerName}</dd>
        <dt>Publiée le</dt>
        <dd>{formaterDate(a.createdAt)}</dd>
        {a.wanted && (
          <>
            <dt>Recherché en échange</dt>
            <dd>{a.wanted}</dd>
          </>
        )}
      </dl>
      <p className="texte-long">{a.description}</p>
      <Actions annonce={a} recharger={annonce.recharger} />
      {auth.connecte && estMembre(auth) && !a.mine && (
        <Signaler cible="LISTING" identifiant={a.id} libelle="cette annonce" />
      )}
    </article>
  );
}
