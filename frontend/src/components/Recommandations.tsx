import { Link } from 'react-router';
import type { Recommandations as Donnees } from '../api/recommandations';
import { estMembre, useAuth } from '../auth/auth';
import { formaterPrix } from '../format';

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
      <ul className="grille-produits">
        {donnees.items.map(({ product, reason }) => (
          <li key={product.id} className="carte-produit">
            {product.exclusive && <p className="etiquette etiquette-exclusif">Exclusivité Evil Ed</p>}
            <h3>
              <Link to={`/produits/${product.id}`}>{product.name}</Link>
            </h3>
            <p className="prix">{formaterPrix(product.price.amountCents, product.price.currency)}</p>
            <p className="note">{reason}</p>
          </li>
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
