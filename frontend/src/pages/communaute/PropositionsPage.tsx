import { Link } from 'react-router';
import { STATUTS_PROPOSITION, mesPropositions, type Proposition } from '../../api/communaute';
import { useAuth } from '../../auth/auth';
import { Chargement, MessageErreur } from '../../components/Etats';
import { formaterDate } from '../../format';
import { useRessource } from '../../hooks/useRessource';
import { useTitre } from '../../hooks/useTitre';

interface Props {
  id: string;
  titre: string;
  propositions: Proposition[];
  vide: string;
}

function Tableau({ id, titre, propositions, vide }: Props) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id}>{titre}</h2>
      {propositions.length === 0 ? (
        <p>{vide}</p>
      ) : (
        <div className="tableau-defilant">
          <table className="tableau">
            <caption className="visuellement-masque">{titre}</caption>
            <thead>
              <tr>
                <th scope="col">Annonce</th>
                <th scope="col">Avec</th>
                <th scope="col">Statut</th>
                <th scope="col">Dernière activité</th>
              </tr>
            </thead>
            <tbody>
              {propositions.map((proposition) => (
                <tr key={proposition.id}>
                  <th scope="row">
                    <Link to={`/communaute/propositions/${proposition.id}`}>{proposition.listingTitle}</Link>
                  </th>
                  <td>{proposition.sent ? proposition.ownerName : proposition.authorName}</td>
                  <td>
                    <span className={`statut statut-offre-${proposition.status.toLowerCase()}`}>
                      {STATUTS_PROPOSITION[proposition.status]}
                    </span>
                  </td>
                  <td>{formaterDate(proposition.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** US9 — propositions reçues sur mes annonces et propositions envoyées. */
export function PropositionsPage() {
  useTitre('Mes propositions');
  const auth = useAuth();
  const propositions = useRessource('propositions', (signal) => mesPropositions(auth.jeton, signal));
  return (
    <>
      <h1 tabIndex={-1}>Mes propositions</h1>
      <p>
        <Link to="/communaute">Parcourir les annonces</Link>
      </p>
      {propositions.chargement && <Chargement texte="Chargement des propositions…" />}
      {propositions.erreur && <MessageErreur erreur={propositions.erreur} onReessayer={propositions.recharger} />}
      {propositions.donnees && (
        <>
          <Tableau
            id="propositions-recues"
            titre="Propositions reçues"
            propositions={propositions.donnees.received}
            vide="Aucune proposition reçue sur vos annonces."
          />
          <Tableau
            id="propositions-envoyees"
            titre="Propositions envoyées"
            propositions={propositions.donnees.sent}
            vide="Vous n'avez fait aucune proposition."
          />
        </>
      )}
    </>
  );
}
