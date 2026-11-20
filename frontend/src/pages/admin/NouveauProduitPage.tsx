import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link } from 'react-router';
import { centimesDepuisSaisie, creerProduit, envoyerImage, reapprovisionner, verifierImage } from '../../api/admin';
import { listerCategories } from '../../api/catalogue';
import { ApiError, versApiError } from '../../api/client';
import type { Product } from '../../api/types';
import { useAuth } from '../../auth/auth';
import { Chargement, MessageErreur } from '../../components/Etats';
import { ImageProduit } from '../../components/ImageProduit';
import { formaterPrix } from '../../format';
import { useRessource } from '../../hooks/useRessource';
import { useTitre } from '../../hooks/useTitre';

interface Resultat {
  produit: Product;
  stock: number;
  /** Le produit est créé mais le stock initial n'a pas pu être enregistré. */
  erreurStock?: ApiError;
  /** Le produit est créé mais son image n'a pas pu être enregistrée. */
  erreurImage?: ApiError;
}

/** Aperçu local de l'image choisie (adresse blob:, libérée quand l'image change ou que la page se ferme). */
function useApercu(fichier: File | undefined): string | undefined {
  const adresse = useMemo(
    () => (fichier && typeof URL.createObjectURL === 'function' ? URL.createObjectURL(fichier) : undefined),
    [fichier],
  );
  useEffect(
    () => () => {
      if (adresse) URL.revokeObjectURL(adresse);
    },
    [adresse],
  );
  return adresse;
}

/** US18 — ajout d'un produit au catalogue, avec son stock initial, par l'administrateur. */
export function NouveauProduitPage() {
  useTitre('Nouveau produit');
  const auth = useAuth();
  const categories = useRessource('categories', listerCategories);
  const [resultat, setResultat] = useState<Resultat>();
  const [erreur, setErreur] = useState<ApiError>();
  const [envoi, setEnvoi] = useState(false);
  const [image, setImage] = useState<File>();
  const [erreurFichier, setErreurFichier] = useState<string>();
  const apercu = useApercu(image);

  function choisirImage(evenement: ChangeEvent<HTMLInputElement>) {
    const fichier = evenement.target.files?.[0];
    const probleme = fichier ? verifierImage(fichier) : null;
    setErreurFichier(probleme ?? undefined);
    setImage(fichier && !probleme ? fichier : undefined);
    if (probleme) evenement.target.value = '';
  }

  async function enregistrer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const formulaire = evenement.currentTarget;
    const donnees = new FormData(formulaire);
    const champ = (nom: string) => String(donnees.get(nom) ?? '').trim();
    const prix = centimesDepuisSaisie(champ('prix'));
    setErreur(undefined);
    setResultat(undefined);
    if (prix === null) {
      setErreur(new ApiError(400, 'Prix invalide : saisissez un montant en euros, par exemple 24,90.'));
      return;
    }
    const stock = Number.parseInt(champ('stock') || '0', 10);
    setEnvoi(true);
    try {
      const produit = await creerProduit(
        {
          sku: champ('reference').toUpperCase(),
          name: champ('nom'),
          description: champ('description'),
          priceCents: prix,
          category: champ('categorie'),
          exclusive: donnees.get('exclusif') === 'on',
        },
        auth.jeton,
      );
      let erreurImage: ApiError | undefined;
      let enregistre = produit;
      if (image) {
        try {
          enregistre = await envoyerImage(produit.id, image, auth.jeton);
        } catch (e) {
          const cause = versApiError(e);
          erreurImage = new ApiError(
            cause.status,
            `Produit créé, mais l'image n'a pas été enregistrée : ${cause.message} Ajoutez-la depuis « Produits et stock ».`,
            cause.correlationId,
          );
        }
      }
      let erreurStock: ApiError | undefined;
      if (stock > 0) {
        try {
          await reapprovisionner(produit.id, stock, auth.jeton);
        } catch (e) {
          const cause = versApiError(e);
          erreurStock = new ApiError(
            cause.status,
            `Produit créé, mais le stock initial n'a pas été enregistré : ${cause.message} Réapprovisionnez-le depuis « Produits et stock ».`,
            cause.correlationId,
          );
        }
      }
      setResultat({ produit: enregistre, stock, erreurStock, erreurImage });
      formulaire.reset();
      setImage(undefined);
    } catch (e) {
      setErreur(versApiError(e));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <>
      <h1 tabIndex={-1}>Nouveau produit</h1>
      <p>
        <Link to="/admin/stock">Retour aux produits et au stock</Link>
      </p>
      <div role="status">
        {resultat && (
          <div className="alerte alerte-succes resultat-produit">
            <ImageProduit produit={resultat.produit} className="vignette" />
            <p>
              Produit créé et mis en vente :{' '}
              <Link to={`/produits/${resultat.produit.id}`}>{resultat.produit.name}</Link> (
              {formaterPrix(resultat.produit.price.amountCents, resultat.produit.price.currency)}).
              {!resultat.erreurStock &&
                (resultat.stock > 0
                  ? ` Stock initial : ${resultat.stock} unité${resultat.stock > 1 ? 's' : ''}.`
                  : ' Aucun stock pour le moment : réapprovisionnez-le depuis « Produits et stock ».')}
            </p>
          </div>
        )}
      </div>
      {resultat?.erreurImage && <MessageErreur erreur={resultat.erreurImage} />}
      {resultat?.erreurStock && <MessageErreur erreur={resultat.erreurStock} />}
      {categories.chargement && <Chargement texte="Chargement des catégories…" />}
      {categories.erreur && <MessageErreur erreur={categories.erreur} onReessayer={categories.recharger} />}
      {categories.donnees && (
        <form className="formulaire" onSubmit={(e) => void enregistrer(e)}>
          {erreur && <MessageErreur erreur={erreur} />}
          <label htmlFor="produit-nom">Nom (3 à 200 caractères)</label>
          <input id="produit-nom" name="nom" required minLength={3} maxLength={200} />
          <label htmlFor="produit-reference">Référence unique (majuscules, chiffres et tirets, ex. FIG-EVL-042)</label>
          <input
            id="produit-reference"
            name="reference"
            required
            minLength={3}
            maxLength={40}
            pattern="[A-Za-z0-9][A-Za-z0-9\-]{2,39}"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <label htmlFor="produit-categorie">Catégorie</label>
          <select id="produit-categorie" name="categorie" required defaultValue="">
            <option value="" disabled>
              Choisir une catégorie
            </option>
            {categories.donnees.map((categorie) => (
              <option key={categorie} value={categorie}>
                {categorie}
              </option>
            ))}
          </select>
          <label htmlFor="produit-prix">Prix en euros (ex. 24,90)</label>
          <input id="produit-prix" name="prix" required inputMode="decimal" pattern="\d{1,5}([,.]\d{1,2})?" />
          <label htmlFor="produit-description">Description (facultative, 2 000 caractères au plus)</label>
          <textarea id="produit-description" name="description" maxLength={2000} rows={4} />
          <label htmlFor="produit-image">Image du produit (facultative : JPEG, PNG ou WebP, 2 Mo au plus)</label>
          <input
            id="produit-image"
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={choisirImage}
            aria-describedby={erreurFichier ? 'aide-image erreur-image' : 'aide-image'}
            aria-invalid={erreurFichier ? true : undefined}
          />
          <p id="aide-image" className="note">
            Format carré conseillé (600 × 600 pixels ou plus), produit centré sur un fond clair.
          </p>
          {erreurFichier && (
            <p id="erreur-image" className="erreur-champ">
              {erreurFichier}
            </p>
          )}
          {apercu && (
            <figure className="apercu-image">
              <img src={apercu} alt="" width={160} height={160} />
              <figcaption>Aperçu : {image?.name}</figcaption>
            </figure>
          )}
          <label htmlFor="produit-stock">Stock initial (unités disponibles à la vente)</label>
          <input id="produit-stock" name="stock" type="number" inputMode="numeric" min={0} max={10000} defaultValue={0} />
          <div className="case">
            <input id="produit-exclusif" name="exclusif" type="checkbox" />
            <label htmlFor="produit-exclusif">Exclusivité Evil Ed (mise en avant dans le catalogue)</label>
          </div>
          <div className="actions">
            <button type="submit" className="bouton" disabled={envoi}>
              {envoi ? 'Enregistrement…' : 'Créer le produit'}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
