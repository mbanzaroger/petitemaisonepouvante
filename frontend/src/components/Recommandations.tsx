import { Link } from 'react-router';
import type { Recommandations as Donnees } from '../api/recommandations';
import { estMembre, useAuth } from '../auth/auth';
import { CarteProduit } from './CarteProduit';

/**
 * US13 — produits recommandés, avec la raison de chaque recommandation. Contenu secondaire : rien n'est affiché
 * pendant le chargement ou en cas d'erreur, et la section est placée après le contenu principal (pas de décalage).
 */
export function Recommandations({ donnees, titre }: { donnees?: Donnees; titre: string }) {
  const auth = useAuth();
  if (!donnees || donnees.items.length === 0) return null;
  return (
    <section aria-labelledby="titre-recommandations" className="recommandations">
      <h2 id="titre-recommandations">{donnees.personalized ? 'Recommandé pour vous' : titre}</h2>
      <ul className="grille-produits vue-grille grille-compacte">
        {donnees.items.map(({ product, reason }) => (
          <CarteProduit key={product.id} produit={product} niveauTitre={3}>
            <p className="note">{reason}</p>
          </CarteProduit>
        ))}
      </ul>
      {!donnees.personalized && estMembre(auth) && (
        <p className="note">
          Recevez des recommandations selon vos consultations et vos achats : activez-les dans{' '}
          <Link to="/mon-espace">Mon espace</Link>.
        </p>
      )}
    </section>
  );
}
