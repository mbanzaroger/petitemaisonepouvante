import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { lireProduit } from '../api/catalogue';
import { signalerSansAttendre } from '../api/recommandations';
import { useAuth } from '../auth/auth';
import { usePanier } from '../cart/contexte';
import { QUANTITE_MAX } from '../cart/panier';
import { Chargement, MessageErreur } from '../components/Etats';
import { Recommandations } from '../components/Recommandations';
import { formaterPrix } from '../format';
import { useRecommandations } from '../hooks/useRecommandations';
import { useRessource } from '../hooks/useRessource';
import { useTitre } from '../hooks/useTitre';

const QUANTITES = Array.from({ length: QUANTITE_MAX }, (_, i) => i + 1);

export function ProduitPage() {
  const { id = '' } = useParams();
  const { donnees: produit, erreur, chargement, recharger } = useRessource(`produit:${id}`, (signal) =>
    lireProduit(id, signal),
  );
  const { ajouter } = usePanier();
  const [annonce, setAnnonce] = useState('');
  const introuvable = erreur?.status === 404;
  useTitre(produit ? produit.name : introuvable ? 'Produit introuvable' : 'Fiche produit');
  const auth = useAuth();
  const recommandations = useRecommandations(id);
  const personnalise = recommandations.donnees?.personalized === true;
  const produitCharge = produit?.id;

  // Consultation d'une fiche : signal d'intérêt, envoyé seulement si le membre a activé la personnalisation.
  useEffect(() => {
    if (personnalise && produitCharge) signalerSansAttendre({ kind: 'VIEW', productId: produitCharge }, auth.jeton);
  }, [personnalise, produitCharge, auth.jeton]);

  function ajouterAuPanier(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!produit) return;
    const quantite = Number(new FormData(evenement.currentTarget).get('quantite') ?? 1);
    setAnnonce(ajouter(produit, quantite));
  }

  return (
    <>
      <p className="fil">
        <Link to="/">Retour au catalogue</Link>
      </p>
      <h1 tabIndex={-1}>{produit ? produit.name : introuvable ? 'Produit introuvable' : 'Fiche produit'}</h1>
      {chargement && <Chargement texte="Chargement du produit…" />}
      {introuvable && <p>Ce produit n'existe pas ou n'est plus proposé.</p>}
      {erreur && !introuvable && <MessageErreur erreur={erreur} onReessayer={recharger} />}
      {produit && (
        <article className="fiche-produit" aria-labelledby="titre-fiche">
          <h2 id="titre-fiche" className="visuellement-masque">
            Détails du produit
          </h2>
          {produit.exclusive && <p className="etiquette etiquette-exclusif">Exclusivité Evil Ed, uniquement sur le site</p>}
          <p className="description">{produit.description}</p>
          <dl className="caracteristiques">
            <dt>Catégorie</dt>
            <dd>{produit.category}</dd>
            <dt>Référence</dt>
            <dd>{produit.sku}</dd>
            <dt>Prix</dt>
            <dd className="prix">{formaterPrix(produit.price.amountCents, produit.price.currency)}</dd>
            <dt>Disponibilité</dt>
            <dd>{produit.available ? 'Disponible' : 'Indisponible'}</dd>
          </dl>
          {produit.available && (
            <form className="ajout-panier" onSubmit={ajouterAuPanier}>
              <label htmlFor="quantite">Quantité</label>
              <select id="quantite" name="quantite" defaultValue="1">
                {QUANTITES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              <button type="submit" className="bouton">
                Ajouter au panier
              </button>
            </form>
          )}
          <p role="status" className="annonce">
            {annonce}
          </p>
          {annonce && (
            <p>
              <Link to="/panier">Voir le panier</Link>
            </p>
          )}
        </article>
      )}
      {produit && <Recommandations donnees={recommandations.donnees} titre="Vous aimerez aussi" />}
    </>
  );
}
