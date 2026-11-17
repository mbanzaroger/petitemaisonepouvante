import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Etat {
  erreur: boolean;
}

/**
 * Filet de sécurité : une erreur de rendu (ou le chargement d'une page devenu impossible après un déploiement)
 * affiche un message clair au lieu d'une page blanche. Réinitialisé à chaque navigation (clé = adresse).
 */
export class ErreurInattendue extends Component<{ children: ReactNode }, Etat> {
  state: Etat = { erreur: false };

  static getDerivedStateFromError(): Etat {
    return { erreur: true };
  }

  componentDidCatch(erreur: unknown, info: ErrorInfo) {
    console.error('Erreur inattendue dans la page', erreur, info.componentStack);
  }

  render() {
    if (!this.state.erreur) return this.props.children;
    return (
      <section aria-labelledby="titre-erreur">
        <h1 id="titre-erreur" tabIndex={-1}>
          Une erreur inattendue est survenue
        </h1>
        <div role="alert" className="alerte alerte-erreur">
          <p>
            Cette page n'a pas pu s'afficher. Une nouvelle version du site vient peut-être d'être publiée :
            rechargez la page. Votre panier est conservé.
          </p>
        </div>
        <button type="button" className="bouton" onClick={() => window.location.reload()}>
          Recharger la page
        </button>
      </section>
    );
  }
}
