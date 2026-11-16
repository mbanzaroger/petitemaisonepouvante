import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router';
import { lireCommande } from '../api/commandes';
import { useAuth } from '../auth/auth';
import { Chargement, MessageErreur } from '../components/Etats';
import { LIBELLES_STATUT, formaterDate, formaterPrix, numeroCourt } from '../format';
import { useRessource } from '../hooks/useRessource';
import { useTitre } from '../hooks/useTitre';

/** La saga confirme en général en moins d'une seconde ; au-delà de 40 essais (≈ 1 min), on cesse d'interroger. */
export const INTERVALLE_SUIVI_MS = 1500;
export const ESSAIS_SUIVI_MAX = 40;

export function CommandePage() {
  const { id = '' } = useParams();
  const { state } = useLocation();
  const nouvelle = (state as { nouvelle?: boolean } | null)?.nouvelle === true;
  const auth = useAuth();
  const numero = numeroCourt(id);
  useTitre(`Commande ${numero}`);

  const { donnees: commande, erreur, chargement, recharger } = useRessource(
    `commande:${id}`,
    (signal) => lireCommande(id, auth.jeton, signal),
    { conserver: true },
  );
  const [essais, setEssais] = useState(0);
  const enAttente = commande?.status === 'PENDING';

  useEffect(() => {
    if (!enAttente || essais >= ESSAIS_SUIVI_MAX) return;
    const minuteur = setTimeout(() => {
      setEssais((n) => n + 1);
      recharger();
    }, INTERVALLE_SUIVI_MS);
    return () => clearTimeout(minuteur);
  }, [enAttente, essais, recharger]);

  const introuvable = erreur?.status === 404;
  return (
    <>
      <p className="fil">
        <Link to="/commandes">Toutes mes commandes</Link>
      </p>
      <h1 tabIndex={-1}>Commande n° {numero}</h1>
      {nouvelle && <p className="alerte alerte-succes">Merci ! Votre commande a bien été enregistrée.</p>}
      {chargement && !commande && <Chargement texte="Chargement de la commande…" />}
      {introuvable && <p>Cette commande n'existe pas ou ne vous appartient pas.</p>}
      {erreur && !introuvable && <MessageErreur erreur={erreur} onReessayer={recharger} />}
      {commande && (
        <>
          <p role="status" className={`statut statut-${commande.status.toLowerCase()}`}>
            Statut : <strong>{LIBELLES_STATUT[commande.status]}</strong>
          </p>
          {enAttente && essais < ESSAIS_SUIVI_MAX && (
            <p>Nous vérifions la disponibilité en stock ; cette page se met à jour automatiquement.</p>
          )}
          {enAttente && essais >= ESSAIS_SUIVI_MAX && (
            <p>
              La confirmation prend plus de temps que prévu.{' '}
              <button type="button" className="bouton bouton-lien" onClick={recharger}>
                Actualiser le statut
              </button>
            </p>
          )}
          {commande.status === 'CONFIRMED' && <p>Le stock est réservé : votre commande sera préparée.</p>}
          {commande.status === 'CANCELLED' && (
            <p>Le stock était insuffisant pour au moins un article : la commande a été annulée, rien ne vous sera facturé.</p>
          )}
          <dl className="caracteristiques">
            <dt>Passée le</dt>
            <dd>{formaterDate(commande.createdAt)}</dd>
            <dt>Dernière mise à jour</dt>
            <dd>{formaterDate(commande.updatedAt)}</dd>
            <dt>Total</dt>
            <dd className="prix">{formaterPrix(commande.totalCents, commande.currency)}</dd>
          </dl>
          <div className="tableau-defilant">
            <table className="tableau">
              <caption>Articles de la commande</caption>
              <thead>
                <tr>
                  <th scope="col">Produit</th>
                  <th scope="col">Quantité</th>
                  <th scope="col">Prix unitaire</th>
                  <th scope="col">Sous-total</th>
                </tr>
              </thead>
              <tbody>
                {commande.lines.map((ligne) => (
                  <tr key={ligne.productId}>
                    <th scope="row">{ligne.productName}</th>
                    <td>{ligne.quantity}</td>
                    <td>{formaterPrix(ligne.unitPriceCents, commande.currency)}</td>
                    <td>{formaterPrix(ligne.subtotalCents, commande.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
