import { Link } from 'react-router';
import { useTitre } from '../../hooks/useTitre';

export function MentionsLegalesPage() {
  useTitre('Mentions légales');
  return (
    <article className="texte-long">
      <h1 tabIndex={-1}>Mentions légales</h1>
      <div className="alerte">
        <p>
          Ce site est un <strong>démonstrateur</strong> réalisé dans le cadre d'un projet de refonte : les produits,
          les comptes et les commandes sont fictifs, aucun paiement n'est encaissé et aucune marchandise n'est
          expédiée.
        </p>
      </div>

      <h2>Éditeur</h2>
      <p>
        La Petite Maison de l'Épouvante, boutique spécialisée dans les produits dérivés de films et de séries
        d'horreur. Les informations légales complètes (forme juridique, capital, adresse du siège, numéro
        d'immatriculation, directeur de la publication) seront publiées ici avant toute mise en ligne.
      </p>

      <h2>Hébergement</h2>
      <p>
        Version de démonstration hébergée sur un environnement de test éphémère (cluster Kubernetes recréé à chaque
        déploiement). L'hébergeur de production sera indiqué ici avant toute mise en ligne.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Les textes et la présentation du site appartiennent à l'éditeur. Les noms de produits du catalogue de
        démonstration sont fictifs.
      </p>

      <h2>Accessibilité et données personnelles</h2>
      <p>
        Voir la <Link to="/accessibilite">déclaration d'accessibilité</Link> et la page{' '}
        <Link to="/donnees-personnelles">données personnelles et cookies</Link>.
      </p>
    </article>
  );
}
