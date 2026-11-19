import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { versApiError, type ApiError } from '../../api/client';
import { listerSignalements, moderer, type Signalement, type StatutSignalement } from '../../api/communaute';
import { useAuth } from '../../auth/auth';
import { Chargement, MessageErreur } from '../../components/Etats';
import { formaterDate } from '../../format';
import { useRessource } from '../../hooks/useRessource';
import { useTitre } from '../../hooks/useTitre';

const STATUTS: Record<StatutSignalement, string> = {
  OPEN: 'À traiter',
  ACTIONED: 'Contenu masqué',
  DISMISSED: 'Rejetés',
};

function Contenu({ signalement }: { signalement: Signalement }) {
  if (signalement.targetType === 'LISTING') {
    return (
      <>
        Annonce :{' '}
        <Link to={`/communaute/annonces/${signalement.targetId}`}>{signalement.excerpt ?? 'contenu supprimé'}</Link>
      </>
    );
  }
  return (
    <>
      Message : <q>{signalement.excerpt ?? 'contenu supprimé'}</q>
    </>
  );
}

/** US12 — modération de l'espace communautaire (rôle ADMIN) : masquer un contenu signalé ou rejeter le signalement. */
export function ModerationPage() {
  useTitre('Modération');
  const auth = useAuth();
  const [params, setParams] = useSearchParams();
  const statut = (Object.hasOwn(STATUTS, params.get('statut') ?? '') ? params.get('statut') : 'OPEN') as StatutSignalement;
  const signalements = useRessource(`signalements:${statut}`, (signal) => listerSignalements(statut, auth.jeton, signal));
  const [annonce, setAnnonce] = useState('');
  const [erreur, setErreur] = useState<ApiError>();

  async function decider(signalement: Signalement, decision: 'hide' | 'dismiss') {
    setErreur(undefined);
    try {
      await moderer(signalement.id, decision, auth.jeton);
      setAnnonce(decision === 'hide' ? 'Contenu masqué ; son auteur est prévenu.' : 'Signalement rejeté.');
      signalements.recharger();
    } catch (e) {
      setErreur(versApiError(e));
    }
  }

  return (
    <>
      <h1 tabIndex={-1}>Modération</h1>
      <form className="filtres" aria-label="Filtrer les signalements">
        <label htmlFor="statut-signalement">Signalements</label>
        <select
          id="statut-signalement"
          value={statut}
          onChange={(e) => setParams(e.target.value === 'OPEN' ? {} : { statut: e.target.value })}
        >
          {Object.entries(STATUTS).map(([valeur, libelle]) => (
            <option key={valeur} value={valeur}>
              {libelle}
            </option>
          ))}
        </select>
      </form>
      <p role="status">{annonce}</p>
      {erreur && <MessageErreur erreur={erreur} />}
      {signalements.chargement && <Chargement texte="Chargement des signalements…" />}
      {signalements.erreur && <MessageErreur erreur={signalements.erreur} onReessayer={signalements.recharger} />}
      {signalements.donnees && signalements.donnees.length === 0 && <p>Aucun signalement.</p>}
      {signalements.donnees && signalements.donnees.length > 0 && (
        <div className="tableau-defilant">
          <table className="tableau">
            <caption>Signalements : {STATUTS[statut].toLowerCase()}</caption>
            <thead>
              <tr>
                <th scope="col">Contenu</th>
                <th scope="col">Auteur</th>
                <th scope="col">Signalé par</th>
                <th scope="col">Motif</th>
                <th scope="col">Date</th>
                {statut === 'OPEN' ? <th scope="col">Décision</th> : <th scope="col">Traité par</th>}
              </tr>
            </thead>
            <tbody>
              {signalements.donnees.map((signalement) => (
                <tr key={signalement.id}>
                  <th scope="row">
                    <Contenu signalement={signalement} />
                  </th>
                  <td>{signalement.targetAuthorName ?? '—'}</td>
                  <td>{signalement.reporterName}</td>
                  <td>{signalement.reason}</td>
                  <td>{formaterDate(signalement.createdAt)}</td>
                  <td>
                    {statut === 'OPEN' ? (
                      <div className="actions">
                        <button type="button" className="bouton" onClick={() => void decider(signalement, 'hide')}>
                          Masquer <span className="visuellement-masque">le contenu signalé par {signalement.reporterName}</span>
                        </button>
                        <button
                          type="button"
                          className="bouton bouton-secondaire"
                          onClick={() => void decider(signalement, 'dismiss')}
                        >
                          Rejeter <span className="visuellement-masque">le signalement de {signalement.reporterName}</span>
                        </button>
                      </div>
                    ) : (
                      signalement.handledBy
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
