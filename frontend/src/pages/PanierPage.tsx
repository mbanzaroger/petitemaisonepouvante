import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { lireProduits } from '../api/catalogue';
import { versApiError, type ApiError } from '../api/client';
import { passerCommande } from '../api/commandes';
import { lirePersonnalisation, signalerSansAttendre } from '../api/recommandations';
import { estClient, libelleProfil, useAuth } from '../auth/auth';
import { usePanier } from '../cart/contexte';
import { QUANTITE_MAX, lignesIndisponibles } from '../cart/panier';
import { MessageErreur } from '../components/Etats';
import { ImageProduit } from '../components/ImageProduit';
import { formaterPrix } from '../format';
import { useRessource } from '../hooks/useRessource';
import { useTitre } from '../hooks/useTitre';

const QUANTITES = Array.from({ length: QUANTITE_MAX }, (_, i) => i + 1);

function Commander({ bloque }: { bloque: boolean }) {
  const auth = useAuth();
  const panier = usePanier();
  const naviguer = useNavigate();
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<ApiError>();

  if (!auth.pret) return null;
  if (!auth.connecte) {
    return (
      <div className="commande-action">
        <p>
          Connectez-vous pour valider votre commande, ou créez votre compte client en quelques secondes : votre panier
          est conservé.
        </p>
        <div className="actions">
          <button type="button" className="bouton" onClick={auth.connecter}>
            Se connecter pour commander
          </button>
          <button type="button" className="bouton bouton-secondaire" onClick={auth.inscrire}>
            Créer un compte client
          </button>
        </div>
      </div>
    );
  }
  if (!estClient(auth)) {
    return (
      <div role="alert" className="alerte">
        <p>
          Vous êtes connecté avec le compte « {auth.utilisateur} » ({libelleProfil(auth).toLowerCase()}) : ce compte
          n'a pas le profil client et ne peut pas passer de commande. Votre panier est conservé : connectez-vous avec un
          compte client pour le valider.
        </p>
        <button type="button" className="bouton bouton-secondaire" onClick={auth.changerDeCompte}>
          Changer de compte
        </button>
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
      // Achats : signaux d'intérêt pour les recommandations, seulement si le membre l'a accepté (sans bloquer).
      lirePersonnalisation(auth.jeton).then(
        ({ personalized }) => {
          if (personalized) {
            commande.lines.forEach((ligne) =>
              signalerSansAttendre({ kind: 'PURCHASE', productId: ligne.productId }, auth.jeton),
            );
          }
        },
        () => undefined,
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
      {erreur?.status === 401 && (
        <button type="button" className="bouton bouton-secondaire" onClick={auth.connecter}>
          Se reconnecter
        </button>
      )}
      {bloque && <p id="commande-bloquee">Retirez les produits indisponibles pour valider la commande.</p>}
      <button
        type="button"
        className="bouton bouton-principal"
        onClick={() => void valider()}
        disabled={envoi || bloque}
        aria-describedby={bloque ? 'commande-bloquee' : undefined}
      >
        {envoi ? 'Envoi de la commande…' : 'Valider la commande'}
      </button>
    </div>
  );
}

export function PanierPage() {
  useTitre('Panier');
  const panier = usePanier();
  // Revalidation à l'ouverture (et quand la liste des produits change) : prix et disponibilité à jour.
  const ids = panier.lignes.map((ligne) => ligne.productId).sort();
  const revalidation = useRessource(ids.length > 0 ? `revalidation:${ids.join(',')}` : null, async (signal) => {
    const produits = await lireProduits(ids, signal);
    return { produits, changements: panier.synchroniser(produits) };
  });
  const indisponibles = revalidation.donnees
    ? lignesIndisponibles(panier.lignes, revalidation.donnees.produits)
    : new Set<string>();
  const changements = revalidation.donnees?.changements ?? [];
  // Images lues avec la revalidation (le panier enregistré dans le navigateur ne les contient pas).
  const parId = new Map((revalidation.donnees?.produits ?? []).map((p) => [p.id, p]));

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
      <div role="status" className="annonce">
        {changements.length > 0 && (
          <div className="alerte">
            {changements.map((texte) => (
              <p key={texte}>{texte}</p>
            ))}
          </div>
        )}
      </div>
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
                    <span className="ligne-produit">
                      <ImageProduit
                        produit={{ imageUrl: parId.get(ligne.productId)?.imageUrl, category: parId.get(ligne.productId)?.category ?? '' }}
                        className="vignette"
                      />
                      <span>
                        <Link to={`/produits/${ligne.productId}`}>{ligne.nom}</Link>
                        {indisponibles.has(ligne.productId) && <span className="badge-indispo"> Indisponible</span>}
                      </span>
                    </span>
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
      <Commander bloque={indisponibles.size > 0} />
    </>
  );
}
