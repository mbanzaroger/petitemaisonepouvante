import type { ReactNode } from 'react';
import { Link } from 'react-router';
import type { Product } from '../api/types';
import { formaterPrix } from '../format';
import { IconePanier } from './Icones';
import { ImageProduit } from './ImageProduit';

interface Props {
  produit: Product;
  /** Niveau du titre de la carte (h2 dans le catalogue, h3 dans une section de recommandations). */
  niveauTitre?: 2 | 3;
  prioritaire?: boolean;
  /** Ajout au panier : absent, la carte n'a pas de bouton (recommandations). */
  onAjouter?: (produit: Product) => void;
  /** Contenu complémentaire (raison d'une recommandation). */
  children?: ReactNode;
}

/** Carte d'un produit : image, rayon, nom (lien vers la fiche), extrait, prix, disponibilité et ajout au panier. */
export function CarteProduit({ produit, niveauTitre = 2, prioritaire = false, onAjouter, children }: Props) {
  const Titre = niveauTitre === 2 ? 'h2' : 'h3';
  return (
    <li className="carte-produit">
      <div className="carte-visuel">
        <ImageProduit produit={produit} prioritaire={prioritaire} />
        {produit.exclusive && <p className="etiquette etiquette-exclusif">Exclusivité Evil Ed</p>}
      </div>
      <div className="carte-corps">
        <p className="categorie">{produit.category}</p>
        <Titre className="carte-titre">
          <Link to={`/produits/${produit.id}`}>{produit.name}</Link>
        </Titre>
        {produit.description && <p className="carte-description">{produit.description}</p>}
        <p className="prix">{formaterPrix(produit.price.amountCents, produit.price.currency)}</p>
        {onAjouter && (
          <>
            <p className={produit.available ? 'dispo' : 'dispo dispo-non'}>
              {produit.available ? 'Disponible' : 'Indisponible'}
            </p>
            <div className="carte-actions">
              <button
                type="button"
                className="bouton bouton-panier"
                disabled={!produit.available}
                onClick={() => onAjouter(produit)}
              >
                <IconePanier taille={18} /> Ajouter{' '}
                <span className="visuellement-masque">« {produit.name} »</span> au panier
              </button>
            </div>
          </>
        )}
        {children}
      </div>
    </li>
  );
}
