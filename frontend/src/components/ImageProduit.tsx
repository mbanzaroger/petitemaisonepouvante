import type { Product } from '../api/types';
import { IconeRayon } from './Icones';

interface Props {
  produit: Pick<Product, 'imageUrl' | 'category'>;
  /** Texte de remplacement : vide par défaut, le nom du produit étant écrit juste à côté (image décorative). */
  alt?: string;
  /** Image visible dès l'arrivée sur la page (premières cartes, fiche produit) : chargée sans attendre. */
  prioritaire?: boolean;
  className?: string;
}

/**
 * US21 — image d'un produit (servie par le catalogue, adresse versionnée), dimensions déclarées pour éviter tout
 * décalage de la page (CLS). Sans image : pictogramme du rayon sur fond neutre.
 */
export function ImageProduit({ produit, alt = '', prioritaire = false, className = '' }: Props) {
  if (!produit.imageUrl) {
    return (
      <span className={`image-produit image-absente ${className}`} aria-hidden="true">
        <IconeRayon rayon={produit.category} taille={56} />
      </span>
    );
  }
  return (
    <img
      className={`image-produit ${className}`}
      src={produit.imageUrl}
      alt={alt}
      width={600}
      height={600}
      loading={prioritaire ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={prioritaire ? 'high' : 'auto'}
    />
  );
}
