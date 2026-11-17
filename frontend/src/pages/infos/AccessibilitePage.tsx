import { Link } from 'react-router';
import { useTitre } from '../../hooks/useTitre';

/**
 * Déclaration d'accessibilité selon le modèle du RGAA. Sans audit de conformité, le site est déclaré
 * « non conforme » : l'audit manuel est l'action R-13 du plan de remédiation (#94).
 */
export function AccessibilitePage() {
  useTitre("Déclaration d'accessibilité");
  return (
    <article className="texte-long">
      <h1 tabIndex={-1}>Déclaration d'accessibilité</h1>
      <p>
        La Petite Maison de l'Épouvante s'engage à rendre son site accessible à toutes et à tous, conformément au
        référentiel général d'amélioration de l'accessibilité (RGAA). Cette déclaration s'applique au site
        petitemaisonepouvante.com, dans sa version de démonstration.
      </p>

      <h2>État de conformité</h2>
      <p>
        Le site est <strong>non conforme</strong> au RGAA version 4.1 : aucun audit de conformité n'a encore été
        réalisé. En l'absence d'audit, un site ne peut pas être déclaré conforme, même partiellement.
      </p>

      <h2>Résultats des tests</h2>
      <p>En attendant l'audit, l'accessibilité est vérifiée automatiquement à chaque évolution du site :</p>
      <ul>
        <li>
          à chaque modification du code, des règles d'analyse dédiées à l'accessibilité (eslint-plugin-jsx-a11y,
          mode strict) bloquent toute erreur détectable ;
        </li>
        <li>
          à chaque déploiement, l'outil axe-core contrôle les pages principales (catalogue, fiche produit, panier,
          connexion requise, suivi de commande, historique, page introuvable) : aucune erreur n'est relevée ;
        </li>
        <li>des tests vérifient la navigation au clavier, le lien d'évitement et le placement du focus.</li>
      </ul>
      <p>
        Ces contrôles automatisés ne couvrent qu'une partie des critères du RGAA. Un audit manuel complet, avec
        lecteurs d'écran, est planifié avant la mise en ligne.
      </p>

      <h2>Contenus non accessibles</h2>
      <ul>
        <li>
          La page de connexion, fournie par le service d'authentification, n'a pas encore été évaluée en dehors des
          contrôles automatisés.
        </li>
        <li>
          La restitution par les lecteurs d'écran (NVDA, VoiceOver) et l'affichage avec un zoom de 200 % n'ont pas
          encore été vérifiés manuellement.
        </li>
      </ul>

      <h2>Établissement de cette déclaration</h2>
      <p>Cette déclaration a été établie le 17 novembre 2026.</p>
      <h3>Technologies utilisées</h3>
      <ul>
        <li>HTML5, CSS, JavaScript (React)</li>
        <li>WAI-ARIA (zones de statut annonçant les ajouts au panier et l'avancement des commandes)</li>
      </ul>
      <h3>Environnement des contrôles automatisés</h3>
      <ul>
        <li>Navigateur Chromium piloté par Playwright, analyse axe-core (règles WCAG 2.2 niveaux A et AA)</li>
        <li>Navigation au clavier simulée</li>
      </ul>

      <h2>Retour d'information et contact</h2>
      <p>
        Si vous n'arrivez pas à accéder à un contenu ou à un service, écrivez-nous à{' '}
        <a href="mailto:accessibilite@petitemaisonepouvante.com">accessibilite@petitemaisonepouvante.com</a> : nous
        vous orienterons vers une alternative accessible ou vous transmettrons le contenu sous une autre forme.
      </p>

      <h2>Voies de recours</h2>
      <p>
        Si vous nous avez signalé un défaut d'accessibilité qui vous empêche d'accéder à un contenu ou à un service
        et que vous n'avez pas obtenu de réponse satisfaisante, vous pouvez :
      </p>
      <ul>
        <li>
          écrire un message au Défenseur des droits (
          <a href="https://formulaire.defenseurdesdroits.fr/">formulaire en ligne</a>) ;
        </li>
        <li>
          contacter le délégué du Défenseur des droits dans votre région (
          <a href="https://www.defenseurdesdroits.fr/carte-des-delegues">carte des délégués</a>) ;
        </li>
        <li>appeler le 09 69 39 00 00 ;</li>
        <li>
          envoyer un courrier par la poste (gratuit, ne pas mettre de timbre) : Défenseur des droits, Libre réponse
          71120, 75342 Paris CEDEX 07.
        </li>
      </ul>
      <p>
        <Link to="/plan-du-site">Plan du site</Link>
      </p>
    </article>
  );
}
