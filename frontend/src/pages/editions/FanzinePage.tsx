import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { versApiError, type ApiError } from '../../api/client';
import { acheterNumero, listerFormules, listerNumeros, type Numero } from '../../api/editions';
import { estMembre, useAuth } from '../../auth/auth';
import { Chargement, MessageErreur } from '../../components/Etats';
import { formaterJour, formaterPrix } from '../../format';
import { useRessource } from '../../hooks/useRessource';
import { useTitre } from '../../hooks/useTitre';

const ACCES = { PURCHASE: 'Dans votre bibliothèque', SUBSCRIPTION: 'Inclus dans votre abonnement' } as const;

function Actions({ numero, apresAchat }: { numero: Numero; apresAchat: () => void }) {
  const auth = useAuth();
  const naviguer = useNavigate();
  const [erreur, setErreur] = useState<ApiError>();
  const [envoi, setEnvoi] = useState(false);
  const lecture = `/fanzine/${numero.number}/lecture`;

  async function acheter() {
    setEnvoi(true);
    setErreur(undefined);
    try {
      await acheterNumero(numero.number, auth.jeton);
      apresAchat();
      void naviguer(`${lecture}?page=2`, { state: { achete: true } });
    } catch (e) {
      setErreur(versApiError(e));
      setEnvoi(false);
    }
  }

  if (numero.access !== 'PREVIEW') {
    return (
      <>
        <p className="statut statut-confirmed">{ACCES[numero.access]}</p>
        <Link className="bouton" to={lecture}>
          Lire <span className="visuellement-masque">le numéro {numero.number}</span>
        </Link>
      </>
    );
  }
  return (
    <>
      {erreur && <MessageErreur erreur={erreur} />}
      <div className="actions">
        <Link className="bouton bouton-secondaire" to={lecture}>
          Lire l'extrait <span className="visuellement-masque">du numéro {numero.number}</span>
        </Link>
        {estMembre(auth) && (
          <button type="button" className="bouton" disabled={envoi} onClick={() => void acheter()}>
            Acheter <span className="visuellement-masque">le numéro {numero.number}</span> (
            {formaterPrix(numero.priceCents)})
          </button>
        )}
      </div>
    </>
  );
}

/** US16, US17 — numéros du fanzine en version numérique et formules d'abonnement. */
export function FanzinePage() {
  useTitre('Fanzine');
  const auth = useAuth();
  const numeros = useRessource(auth.pret ? `numeros:${auth.connecte}` : null, (signal) =>
    listerNumeros(auth.connecte ? auth.jeton : undefined, signal),
  );
  const formules = useRessource('formules', listerFormules);

  return (
    <>
      <h1 tabIndex={-1}>Le fanzine</h1>
      <p>
        Le fanzine de La Petite Maison, en version numérique : la première page de chaque numéro est en lecture libre, la
        suite se lit dans la liseuse de votre espace après achat ou avec un abonnement. La version papier reste vendue
        dans la <Link to="/?categorie=Fanzine">boutique</Link>.
      </p>
      {auth.pret && !auth.connecte && (
        <p>
          <button type="button" className="bouton bouton-secondaire" onClick={auth.connecter}>
            Se connecter pour acheter ou s'abonner
          </button>
        </p>
      )}
      {numeros.chargement && <Chargement texte="Chargement des numéros…" />}
      {numeros.erreur && <MessageErreur erreur={numeros.erreur} onReessayer={numeros.recharger} />}
      {numeros.donnees && (
        <ul className="grille-produits">
          {numeros.donnees.map((numero) => (
            <li key={numero.number} className="carte-produit">
              <h2>{numero.title}</h2>
              <p className="note">
                Paru le {formaterJour(numero.publishedOn)} · {numero.pageCount} pages
              </p>
              <p>{numero.summary}</p>
              <Actions numero={numero} apresAchat={numeros.recharger} />
            </li>
          ))}
        </ul>
      )}
      <section aria-labelledby="titre-abonnement" className="recommandations">
        <h2 id="titre-abonnement">S'abonner</h2>
        {formules.donnees && (
          <ul>
            {formules.donnees.map((formule) => (
              <li key={formule.code}>
                <strong>{formule.label}</strong> : {formaterPrix(formule.priceCents)} par an
                {formule.paper ? ' (numéros papier livrés à domicile et accès numérique)' : ' (tous les numéros dans la liseuse)'}
              </li>
            ))}
          </ul>
        )}
        <p>
          <Link to="/fanzine/abonnement">{estMembre(auth) ? 'Gérer mon abonnement' : "Voir l'abonnement"}</Link>
        </p>
      </section>
    </>
  );
}
