import { Link } from 'react-router';
import { listerCategories } from '../../api/catalogue';
import { estAdmin, useAuth } from '../../auth/auth';
import { useRessource } from '../../hooks/useRessource';
import { useTitre } from '../../hooks/useTitre';

/** Second système de navigation, en plus du menu (RGAA 12.1). */
export function PlanDuSitePage() {
  useTitre('Plan du site');
  const auth = useAuth();
  const { donnees: categories } = useRessource('categories', listerCategories);
  return (
    <>
      <h1 tabIndex={-1}>Plan du site</h1>
      <nav aria-label="Plan du site" className="plan">
        <ul>
          <li>
            <Link to="/">Catalogue</Link>
            {categories && categories.length > 0 && (
              <ul>
                {categories.map((nom) => (
                  <li key={nom}>
                    <Link to={`/?categorie=${encodeURIComponent(nom)}`}>{nom}</Link>
                  </li>
                ))}
              </ul>
            )}
          </li>
          <li>
            <Link to="/panier">Panier</Link>
          </li>
          <li>
            <Link to="/commandes">Mes commandes</Link> (connexion requise)
          </li>
          <li>
            <Link to="/communaute">Troc et dons</Link>
            <ul>
              <li>
                <Link to="/communaute/publier">Publier une annonce</Link> (connexion requise)
              </li>
              <li>
                <Link to="/communaute/propositions">Mes propositions</Link> (connexion requise)
              </li>
              <li>
                <Link to="/communaute/salons">Salons de discussion</Link> (connexion requise)
              </li>
            </ul>
          </li>
          <li>
            <Link to="/mon-espace">Mon espace</Link> (connexion requise)
          </li>
          {estAdmin(auth) && (
            <>
              <li>
                <Link to="/admin/stock">Stock</Link> (administrateurs)
              </li>
              <li>
                <Link to="/admin/moderation">Modération</Link> (administrateurs)
              </li>
            </>
          )}
          <li>
            Informations
            <ul>
              <li>
                <Link to="/accessibilite">Déclaration d'accessibilité</Link>
              </li>
              <li>
                <Link to="/mentions-legales">Mentions légales</Link>
              </li>
              <li>
                <Link to="/donnees-personnelles">Données personnelles et cookies</Link>
              </li>
            </ul>
          </li>
        </ul>
      </nav>
    </>
  );
}
