import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { lireProduit } from '../api/catalogue';
import { signalerSansAttendre } from '../api/recommandations';
import { useAuth } from '../auth/auth';
import { usePanier } from '../cart/contexte';
import { QUANTITE_MAX } from '../cart/panier';
import { Chargement, MessageErreur } from '../components/Etats';
import { IconePanier } from '../components/Icones';
import { ImageProduit } from '../components/ImageProduit';
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
      <nav aria-label="Fil d'Ariane" className="fil-ariane">
        <ol>
          <li>
            <Link to="/">Catalogue</Link>
          </li>
          {produit && (
            <li>
              <Link to={`/?categorie=${encodeURIComponent(produit.category)}`}>{produit.category}</Link>
            </li>
          )}
          <li aria-current="page">{produit ? produit.name : 'Fiche produit'}</li>
        </ol>
      </nav>
      <div className={produit ? 'fiche-produit' : 'fiche-produit fiche-vide'}>
        <h1 tabIndex={-1} className="fiche-titre">
          {produit ? produit.name : introuvable ? 'Produit introuvable' : 'Fiche produit'}
        </h1>
        {chargement && <Chargement texte="Chargement du produit…" />}
        {introuvable && (
          <p className="fiche-infos">
            Ce produit n'existe pas ou n'est plus proposé. <Link to="/">Retour au catalogue</Link>
          </p>
        )}
        {erreur && !introuvable && <MessageErreur erreur={erreur} onReessayer={recharger} />}
        {produit && (
          <>
            <div className="fiche-visuel">
              <ImageProduit produit={produit} alt={`Visuel du produit : ${produit.name}`} prioritaire />
            </div>
            <article className="fiche-infos" aria-labelledby="titre-fiche">
              <h2 id="titre-fiche" className="visuellement-masque">
                Détails du produit
              </h2>
              {produit.exclusive && (
                <p className="etiquette etiquette-exclusif">Exclusivité Evil Ed, uniquement sur le site</p>
              )}
              <p className="prix prix-fiche">{formaterPrix(produit.price.amountCents, produit.price.currency)}</p>
              <p className={produit.available ? 'dispo' : 'dispo dispo-non'}>
                {produit.available ? 'En stock' : 'Momentanément indisponible'}
              </p>
              <p className="description">{produit.description}</p>
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
                  <button type="submit" className="bouton bouton-panier">
                    <IconePanier taille={18} /> Ajouter au panier
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
              <dl className="caracteristiques">
                <dt>Catégorie</dt>
                <dd>{produit.category}</dd>
                <dt>Référence</dt>
                <dd>{produit.sku}</dd>
                <dt>Disponibilité</dt>
                <dd>{produit.available ? 'Disponible' : 'Indisponible'}</dd>
              </dl>
            </article>
          </>
        )}
      </div>
      {produit && <Recommandations donnees={recommandations.donnees} titre="Vous aimerez aussi" />}
    </>
  );
}
