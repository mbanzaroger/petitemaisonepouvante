import { Link, useParams } from 'react-router';
import { ecrireSalon, listerSalons, messagesSalon } from '../../api/communaute';
import { useAuth } from '../../auth/auth';
import { Chargement, MessageErreur } from '../../components/Etats';
import { Discussion } from '../../components/communaute/Discussion';
import { useFil } from '../../hooks/useFil';
import { useRessource } from '../../hooks/useRessource';
import { useTitre } from '../../hooks/useTitre';

/** Relevé des nouveaux messages d'un salon. */
export const INTERVALLE_SALON_MS = 4000;

const CHARTE =
  'Charte : bienveillance, pas de vente déguisée, pas de coordonnées personnelles. Les messages signalés sont examinés par la modération.';

/** US10 — salons de discussion entre passionnés. */
export function SalonsPage() {
  useTitre('Salons de discussion');
  const auth = useAuth();
  const salons = useRessource('salons', (signal) => listerSalons(auth.jeton, signal));
  return (
    <>
      <h1 tabIndex={-1}>Salons de discussion</h1>
      <p>{CHARTE}</p>
      {salons.chargement && <Chargement texte="Chargement des salons…" />}
      {salons.erreur && <MessageErreur erreur={salons.erreur} onReessayer={salons.recharger} />}
      {salons.donnees && (
        <ul className="grille-produits">
          {salons.donnees.map((salon) => (
            <li key={salon.code} className="carte-produit">
              <h2>
                <Link to={`/communaute/salons/${salon.code}`}>{salon.name}</Link>
              </h2>
              <p>{salon.description}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function SalonPage() {
  const { code = '' } = useParams();
  const auth = useAuth();
  const salons = useRessource('salons', (signal) => listerSalons(auth.jeton, signal));
  const salon = salons.donnees?.find((candidat) => candidat.code === code);
  const nom = salon?.name ?? 'Salon';
  useTitre(nom);
  const fil = useFil(
    `salon:${code}`,
    (apres, signal) => messagesSalon(code, apres, auth.jeton, signal),
    INTERVALLE_SALON_MS,
  );

  if (salons.donnees && !salon) {
    return (
      <>
        <h1 tabIndex={-1}>Salon introuvable</h1>
        <p>
          <Link to="/communaute/salons">Tous les salons</Link>
        </p>
      </>
    );
  }
  return (
    <>
      <p className="fil">
        <Link to="/communaute/salons">Tous les salons</Link>
      </p>
      <h1 tabIndex={-1}>{nom}</h1>
      {salon && <p>{salon.description}</p>}
      <p className="note">{CHARTE}</p>
      <Discussion
        titre={nom}
        messages={fil.messages}
        charge={fil.charge}
        erreur={fil.erreur}
        ajouter={fil.ajouter}
        envoyer={(contenu) => ecrireSalon(code, contenu, auth.jeton)}
        vide="Aucun message pour le moment : lancez la discussion !"
      />
    </>
  );
}
