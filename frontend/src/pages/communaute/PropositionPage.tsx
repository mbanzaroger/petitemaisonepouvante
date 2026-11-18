import { useEffect, useEffectEvent, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { versApiError, type ApiError } from '../../api/client';
import {
  STATUTS_PROPOSITION,
  deciderProposition,
  ecrireProposition,
  lireProposition,
  messagesProposition,
  type DecisionProposition,
  type Proposition,
} from '../../api/communaute';
import { useAuth } from '../../auth/auth';
import { Chargement, MessageErreur } from '../../components/Etats';
import { Discussion } from '../../components/communaute/Discussion';
import { useFil } from '../../hooks/useFil';
import { useRessource } from '../../hooks/useRessource';
import { useTitre } from '../../hooks/useTitre';

/** Relevé des nouveaux messages de la conversation privée. */
export const INTERVALLE_PROPOSITION_MS = 5000;
/** Relevé du statut (acceptation ou refus décidé par l'autre membre pendant que la page est ouverte). */
export const INTERVALLE_STATUT_MS = 10000;

/** Garde la version la plus récente : un relevé parti avant une décision ne doit pas l'effacer. */
function plusRecente(courante: Proposition | undefined, recue: Proposition): Proposition {
  return courante && Date.parse(courante.updatedAt) > Date.parse(recue.updatedAt) ? courante : recue;
}

const ANNONCES: Record<DecisionProposition, string> = {
  acceptance: "Proposition acceptée : l'annonce est conclue. Convenez de la remise de l'objet ci-dessous.",
  decline: 'Proposition déclinée.',
  cancellation: 'Proposition annulée.',
};

function Decisions({ proposition, mettreAJour }: { proposition: Proposition; mettreAJour: (p: Proposition) => void }) {
  const auth = useAuth();
  const [annonce, setAnnonce] = useState('');
  const [erreur, setErreur] = useState<ApiError>();
  const [envoi, setEnvoi] = useState(false);

  async function decider(decision: DecisionProposition) {
    setEnvoi(true);
    setErreur(undefined);
    try {
      mettreAJour(await deciderProposition(proposition.id, decision, auth.jeton));
      setAnnonce(ANNONCES[decision]);
    } catch (e) {
      setErreur(versApiError(e));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="commande-action">
      <p role="status">{annonce}</p>
      {erreur && <MessageErreur erreur={erreur} />}
      {proposition.status === 'PENDING' && !proposition.sent && (
        <div className="actions">
          <button type="button" className="bouton" disabled={envoi} onClick={() => void decider('acceptance')}>
            Accepter la proposition
          </button>
          <button
            type="button"
            className="bouton bouton-secondaire"
            disabled={envoi}
            onClick={() => void decider('decline')}
          >
            Décliner
          </button>
        </div>
      )}
      {proposition.status === 'PENDING' && proposition.sent && (
        <button
          type="button"
          className="bouton bouton-secondaire"
          disabled={envoi}
          onClick={() => void decider('cancellation')}
        >
          Annuler ma proposition
        </button>
      )}
    </div>
  );
}

/** US9 — une proposition : décision (acceptation, refus, annulation) et conversation privée entre les deux membres. */
export function PropositionPage() {
  const { id = '' } = useParams();
  const auth = useAuth();
  const { state } = useLocation() as { state: { nouvelle?: boolean } | null };
  const chargee = useRessource(`proposition:${id}`, (signal) => lireProposition(id, auth.jeton, signal));
  const [miseAJour, setMiseAJour] = useState<Proposition>();
  const proposition = miseAJour?.id === id ? miseAJour : chargee.donnees;
  const mettreAJour = (recue: Proposition) => setMiseAJour((courante) => plusRecente(courante, recue));
  const releverStatut = useEffectEvent((signal: AbortSignal) =>
    lireProposition(id, auth.jeton, signal).then(mettreAJour, () => undefined),
  );
  useEffect(() => {
    const controleur = new AbortController();
    const minuterie = setInterval(() => void releverStatut(controleur.signal), INTERVALLE_STATUT_MS);
    return () => {
      controleur.abort();
      clearInterval(minuterie);
    };
  }, [id]);
  const fil = useFil(
    proposition ? `proposition:${id}` : null,
    (apres, signal) => messagesProposition(id, apres, auth.jeton, signal),
    INTERVALLE_PROPOSITION_MS,
  );
  useTitre(proposition ? `Proposition : ${proposition.listingTitle}` : 'Proposition');

  if (chargee.erreur) {
    return (
      <>
        <h1 tabIndex={-1}>{chargee.erreur.status === 404 ? 'Proposition introuvable' : 'Proposition'}</h1>
        <MessageErreur erreur={chargee.erreur} onReessayer={chargee.erreur.status === 404 ? undefined : chargee.recharger} />
        <p>
          <Link to="/communaute/propositions">Toutes mes propositions</Link>
        </p>
      </>
    );
  }
  if (!proposition) return <Chargement texte="Chargement de la proposition…" />;

  const interlocuteur = proposition.sent ? proposition.ownerName : proposition.authorName;
  const ouverte = proposition.status === 'PENDING' || proposition.status === 'ACCEPTED';
  return (
    <>
      <p className="fil">
        <Link to="/communaute/propositions">Toutes mes propositions</Link>
      </p>
      <h1 tabIndex={-1}>Proposition pour « {proposition.listingTitle} »</h1>
      {state?.nouvelle && (
        <div role="status" className="alerte alerte-succes">
          <p>Votre proposition a été envoyée à {proposition.ownerName}. Vous serez prévenu de sa réponse.</p>
        </div>
      )}
      <dl className="caracteristiques">
        <dt>Statut</dt>
        <dd>
          <span className={`statut statut-offre-${proposition.status.toLowerCase()}`}>
            {STATUTS_PROPOSITION[proposition.status]}
          </span>
        </dd>
        <dt>{proposition.sent ? 'Annonce de' : 'Proposée par'}</dt>
        <dd>{interlocuteur}</dd>
        <dt>Annonce</dt>
        <dd>
          <Link to={`/communaute/annonces/${proposition.listingId}`}>{proposition.listingTitle}</Link>
        </dd>
      </dl>
      <Decisions proposition={proposition} mettreAJour={mettreAJour} />
      <h2>Conversation avec {interlocuteur}</h2>
      <Discussion
        titre={`conversation avec ${interlocuteur}`}
        messages={fil.messages}
        charge={fil.charge}
        erreur={fil.erreur}
        ajouter={fil.ajouter}
        envoyer={ouverte ? (contenu) => ecrireProposition(id, contenu, auth.jeton) : undefined}
        fermee="La conversation est close : la proposition a été déclinée ou annulée."
      />
    </>
  );
}
