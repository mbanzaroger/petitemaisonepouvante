import { useTitre } from '../../hooks/useTitre';

/** Information des personnes (RGPD, articles 13 et 14) et usage des traceurs (article 82 de la loi Informatique et Libertés). */
export function DonneesPersonnellesPage() {
  useTitre('Données personnelles et cookies');
  return (
    <article className="texte-long">
      <h1 tabIndex={-1}>Données personnelles et cookies</h1>
      <p>
        Cette page explique quelles données le site traite, pourquoi, combien de temps, et comment exercer vos
        droits. Dans cette version de démonstration, seuls des comptes fictifs existent.
      </p>

      <h2>Données traitées et finalités</h2>
      <div className="tableau-defilant">
        <table className="tableau">
          <caption>Traitements de données personnelles</caption>
          <thead>
            <tr>
              <th scope="col">Données</th>
              <th scope="col">Finalité</th>
              <th scope="col">Base légale</th>
              <th scope="col">Durée de conservation prévue</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Compte : identifiant, nom, adresse électronique, mot de passe (stocké haché)</th>
              <td>Connexion et gestion du compte</td>
              <td>Exécution du contrat</td>
              <td>Durée de vie du compte, puis 3 ans sans activité</td>
            </tr>
            <tr>
              <th scope="row">Commandes : produits, quantités, montants, dates, statut</th>
              <td>Traitement et suivi des commandes, historique</td>
              <td>Exécution du contrat ; obligations comptables</td>
              <td>10 ans pour les pièces comptables</td>
            </tr>
            <tr>
              <th scope="row">
                Journaux techniques : date, adresse demandée, statut, identifiant de corrélation ; adresse IP et
                navigateur au point d'entrée ; identifiant interne du client pour les commandes
              </th>
              <td>Sécurité et diagnostic des incidents</td>
              <td>Intérêt légitime</td>
              <td>6 mois</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        Le serveur du site n'enregistre ni adresse IP ni identité. Le point d'entrée enregistre l'adresse IP et le
        navigateur pour détecter les abus ; les services ne mentionnent que l'identifiant interne du client, jamais
        son nom ni son adresse électronique. Un identifiant de corrélation relie un appel du site aux journaux des
        services, pour diagnostiquer un incident signalé.
      </p>

      <h2>Destinataires</h2>
      <p>
        Les données ne sont accessibles qu'aux personnes habilitées de la boutique et à ses sous-traitants
        techniques (hébergement), dans la limite de leurs missions. Elles ne sont ni vendues ni transmises à des
        fins publicitaires.
      </p>

      <h2>Cookies et stockage dans le navigateur</h2>
      <ul>
        <li>
          Le service de connexion dépose des cookies de session <strong>strictement nécessaires</strong> à
          l'authentification ; ils ne demandent pas votre consentement.
        </li>
        <li>
          Le panier est conservé dans le stockage de session du navigateur (identifiants de produits et quantités,
          aucune donnée personnelle) et disparaît à la fermeture de l'onglet.
        </li>
        <li>
          Les jetons de connexion restent en mémoire et ne sont jamais enregistrés dans le navigateur.
        </li>
        <li>Aucun cookie de mesure d'audience, de publicité ou de réseau social n'est utilisé.</li>
      </ul>

      <h2>Vos droits</h2>
      <p>
        Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, de portabilité et
        d'opposition. Écrivez à{' '}
        <a href="mailto:donnees-personnelles@petitemaisonepouvante.com">donnees-personnelles@petitemaisonepouvante.com</a>.
        Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL (
        <a href="https://www.cnil.fr/">cnil.fr</a>).
      </p>
    </article>
  );
}
