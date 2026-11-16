import { Link, useSearchParams } from 'react-router';
import { listerCommandes } from '../api/commandes';
import { useAuth } from '../auth/auth';
import { Chargement, MessageErreur } from '../components/Etats';
import { Pagination } from '../components/Pagination';
import { LIBELLES_STATUT, formaterDate, formaterPrix, numeroCourt } from '../format';
import { useRessource } from '../hooks/useRessource';
import { useTitre } from '../hooks/useTitre';

export function CommandesPage() {
  useTitre('Mes commandes');
  const auth = useAuth();
  const [params] = useSearchParams();
  const brut = Number.parseInt(params.get('page') ?? '1', 10);
  const page = Number.isInteger(brut) && brut >= 1 ? brut : 1;
  const { donnees, erreur, chargement, recharger } = useRessource(`commandes:${page}`, (signal) =>
    listerCommandes(page - 1, auth.jeton, signal),
  );

  return (
    <>
      <h1 tabIndex={-1}>Mes commandes</h1>
      {chargement && <Chargement texte="Chargement de vos commandes…" />}
      {erreur && <MessageErreur erreur={erreur} onReessayer={recharger} />}
      {donnees && donnees.totalElements === 0 && (
        <p>
          Vous n'avez pas encore passé de commande. <Link to="/">Parcourir le catalogue</Link>
        </p>
      )}
      {donnees && donnees.totalElements > 0 && (
        <>
          <div className="tableau-defilant">
            <table className="tableau">
              <caption>
                Historique de mes commandes ({donnees.totalElements} au total, de la plus récente à la plus ancienne)
              </caption>
              <thead>
                <tr>
                  <th scope="col">Commande</th>
                  <th scope="col">Date</th>
                  <th scope="col">Articles</th>
                  <th scope="col">Total</th>
                  <th scope="col">Statut</th>
                </tr>
              </thead>
              <tbody>
                {donnees.content.map((commande) => (
                  <tr key={commande.id}>
                    <th scope="row">
                      <Link to={`/commandes/${commande.id}`}>
                        <span className="visuellement-masque">Commande</span> n° {numeroCourt(commande.id)}
                      </Link>
                    </th>
                    <td>{formaterDate(commande.createdAt)}</td>
                    <td>{commande.lines.reduce((total, ligne) => total + ligne.quantity, 0)}</td>
                    <td>{formaterPrix(commande.totalCents, commande.currency)}</td>
                    <td>
                      <span className={`statut statut-${commande.status.toLowerCase()}`}>
                        {LIBELLES_STATUT[commande.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={page}
            totalPages={donnees.totalPages}
            lien={(n) => `/commandes?page=${n}`}
            libelle="Pages de l'historique"
          />
        </>
      )}
    </>
  );
}
