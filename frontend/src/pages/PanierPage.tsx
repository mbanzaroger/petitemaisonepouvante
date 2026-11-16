import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { versApiError, type ApiError } from '../api/client';
import { passerCommande } from '../api/commandes';
import { estClient, useAuth } from '../auth/auth';
import { usePanier } from '../cart/contexte';
import { QUANTITE_MAX } from '../cart/panier';
import { MessageErreur } from '../components/Etats';
import { formaterPrix } from '../format';
import { useTitre } from '../hooks/useTitre';

const QUANTITES = Array.from({ length: QUANTITE_MAX }, (_, i) => i + 1);

function Commander() {
  const auth = useAuth();
  const panier = usePanier();
  const naviguer = useNavigate();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<ApiError>();

  if (!auth.pret) return null;
  if (!auth.connecte) {
    return (
      <div className="commande-action">
        <p>Connectez-vous pour valider votre commande : votre panier est conservé.</p>
        <button type="button" className="bouton" onClick={auth.connecter}>
          Se connecter pour commander
        </button>
      </div>
    );
  }
  if (!estClient(auth)) {
    return (
      <div role="alert" className="alerte">
        <p>Votre compte n'a pas le profil client : il ne peut pas passer de commande.</p>
      </div>
    );
  }

  async function valider() {
    setEnvoi(true);
    setErreur(undefined);
    try {
      const commande = await passerCommande(
        panier.lignes.map((ligne) => ({ productId: ligne.productId, quantity: ligne.quantite })),
        auth.jeton,
      );
      panier.vider();
      void naviguer(`/commandes/${commande.id}`, { state: { nouvelle: true } });
    } catch (e) {
      setErreur(versApiError(e));
      setEnvoi(false);
    }
  }

  return (
    <div className="commande-action">
      {erreur && <MessageErreur erreur={erreur} />}
      <button type="button" className="bouton bouton-principal" onClick={() => void valider()} disabled={envoi}>
        {envoi ? 'Envoi de la commande…' : 'Valider la commande'}
      </button>
    </div>
  );
}

export function PanierPage() {
  useTitre('Panier');
  const panier = usePanier();

  if (panier.lignes.length === 0) {
    return (
      <>
        <h1 tabIndex={-1}>Panier</h1>
        <p>Votre panier est vide.</p>
        <p>
          <Link to="/">Parcourir le catalogue</Link>
        </p>
      </>
    );
  }

  const devise = panier.lignes[0]?.devise ?? 'EUR';
  return (
    <>
      <h1 tabIndex={-1}>Panier</h1>
      <div className="tableau-defilant">
        <table className="tableau">
          <caption>Contenu du panier</caption>
          <thead>
            <tr>
              <th scope="col">Produit</th>
              <th scope="col">Prix unitaire</th>
              <th scope="col">Quantité</th>
              <th scope="col">Sous-total</th>
              <th scope="col">
                <span className="visuellement-masque">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {panier.lignes.map((ligne) => {
              const idQuantite = `quantite-${ligne.productId}`;
              return (
                <tr key={ligne.productId}>
                  <th scope="row">
                    <Link to={`/produits/${ligne.productId}`}>{ligne.nom}</Link>
                  </th>
                  <td>{formaterPrix(ligne.prixCentimes, ligne.devise)}</td>
                  <td>
                    <label htmlFor={idQuantite} className="visuellement-masque">
                      Quantité pour « {ligne.nom} »
                    </label>
                    <select
                      id={idQuantite}
                      value={ligne.quantite}
                      onChange={(e) => panier.modifierQuantite(ligne.productId, Number(e.target.value))}
                    >
                      {QUANTITES.map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{formaterPrix(ligne.prixCentimes * ligne.quantite, ligne.devise)}</td>
                  <td>
                    <button
                      type="button"
                      className="bouton bouton-lien"
                      onClick={() => panier.retirer(ligne.productId)}
                    >
                      Retirer{' '}
                      <span className="visuellement-masque">« {ligne.nom} » du panier</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3}>
                Total estimé
              </th>
              <td colSpan={2}>{formaterPrix(panier.totalCentimes, devise)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="note">Le montant définitif est calculé à la validation, au prix du catalogue.</p>
      <Commander />
    </>
  );
}
