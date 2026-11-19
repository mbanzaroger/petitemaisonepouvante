import { useSearchParams } from 'react-router';
import { listerCommandesAdmin, lireSyntheseCommandes } from '../../api/admin';
import type { OrderStatus } from '../../api/types';
import { useAuth } from '../../auth/auth';
import { Chargement, MessageErreur } from '../../components/Etats';
import { Pagination } from '../../components/Pagination';
import { LIBELLES_STATUT, formaterDate, formaterPrix, numeroCourt } from '../../format';
import { useRessource } from '../../hooks/useRessource';
import { useTitre } from '../../hooks/useTitre';

const STATUTS: OrderStatus[] = ['PENDING', 'CONFIRMED', 'CANCELLED'];

function statutDepuis(valeur: string | null): OrderStatus | undefined {
  return STATUTS.find((statut) => statut === valeur);
}

/**
 * US19 — commandes de tous les clients, les plus récentes d'abord, filtrables par statut (ADMIN). Les paniers ne
 * sont pas visibles : ils restent dans le navigateur du client tant qu'il n'a pas commandé.
 */
export function CommandesClientsPage() {
  useTitre('Commandes clients');
  const auth = useAuth();
  const [params, setParams] = useSearchParams();
  const brut = Number.parseInt(params.get('page') ?? '1', 10);
  const page = Number.isInteger(brut) && brut >= 1 ? brut : 1;
  const statut = statutDepuis(params.get('statut'));

  const synthese = useRessource('commandes-synthese', (signal) => lireSyntheseCommandes(auth.jeton, signal), {
    conserver: true,
  });
  const commandes = useRessource(
    `commandes-admin:${statut ?? 'toutes'}:${page}`,
    (signal) => listerCommandesAdmin({ page: page - 1, statut }, auth.jeton, signal),
    { conserver: true },
  );

  function filtrer(valeur: string) {
    const suivants = new URLSearchParams();
    if (statutDepuis(valeur)) suivants.set('statut', valeur);
    setParams(suivants);
  }

  function actualiser() {
    synthese.recharger();
    commandes.recharger();
  }

  const lien = (n: number) => `/admin/commandes?${new URLSearchParams({ ...(statut ? { statut } : {}), page: String(n) })}`;

  return (
    <>
      <h1 tabIndex={-1}>Commandes clients</h1>
      <p>
        Toutes les commandes passées sur le site. Une commande reste « en attente » le temps que le stock soit réservé,
        puis elle est confirmée ou annulée (rupture). Les paniers restent dans le navigateur des clients tant qu'ils
        n'ont pas commandé : ils n'apparaissent pas ici.
      </p>
      {synthese.erreur && <MessageErreur erreur={synthese.erreur} onReessayer={synthese.recharger} />}
      {synthese.donnees && (
        <ul className="synthese" aria-label="Synthèse des commandes">
          {STATUTS.map((s) => (
            <li key={s}>
              <strong>{synthese.donnees?.countsByStatus[s] ?? 0}</strong> {LIBELLES_STATUT[s].toLowerCase()}
            </li>
          ))}
          <li>
            <strong>{formaterPrix(synthese.donnees.confirmedRevenueCents, synthese.donnees.currency)}</strong> de
            commandes confirmées
          </li>
        </ul>
      )}
      <div className="barre-outils">
        <div>
          <label htmlFor="filtre-statut">Statut</label>
          <select id="filtre-statut" value={statut ?? ''} onChange={(e) => filtrer(e.target.value)}>
            <option value="">Toutes les commandes</option>
            {STATUTS.map((s) => (
              <option key={s} value={s}>
                {LIBELLES_STATUT[s]}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="bouton bouton-secondaire" onClick={actualiser} disabled={commandes.chargement}>
          {commandes.chargement && commandes.donnees ? 'Actualisation…' : 'Actualiser'}
        </button>
      </div>
      {commandes.chargement && !commandes.donnees && <Chargement texte="Chargement des commandes…" />}
      {commandes.erreur && <MessageErreur erreur={commandes.erreur} onReessayer={commandes.recharger} />}
      {commandes.donnees && commandes.donnees.content.length === 0 && <p>Aucune commande à afficher.</p>}
      {commandes.donnees && commandes.donnees.content.length > 0 && (
        <>
          <div className="tableau-defilant">
            <table className="tableau">
              <caption>
                Commandes {statut ? `« ${LIBELLES_STATUT[statut].toLowerCase()} »` : 'de tous les clients'}, page{' '}
                {page} sur {Math.max(1, commandes.donnees.totalPages)} ({commandes.donnees.totalElements} au total)
              </caption>
              <thead>
                <tr>
                  <th scope="col">Commande</th>
                  <th scope="col">Date</th>
                  <th scope="col">Client</th>
                  <th scope="col">Articles</th>
                  <th scope="col">Total</th>
                  <th scope="col">Statut</th>
                </tr>
              </thead>
              <tbody>
                {commandes.donnees.content.map((commande) => (
                  <tr key={commande.id}>
                    <th scope="row">{numeroCourt(commande.id)}</th>
                    <td>{formaterDate(commande.createdAt)}</td>
                    <td>{commande.customerName ?? 'Non renseigné'}</td>
                    <td>
                      <ul className="liste-simple">
                        {commande.lines.map((ligne) => (
                          <li key={ligne.productId}>
                            {ligne.quantity} × {ligne.productName}
                          </li>
                        ))}
                      </ul>
                    </td>
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
            totalPages={commandes.donnees.totalPages}
            lien={lien}
            libelle="Pages des commandes"
          />
        </>
      )}
    </>
  );
}
