import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { versApiError, type ApiError } from '../../api/client';
import {
  lireAbonnement,
  listerFormules,
  renouveler,
  sAbonner,
  type Abonnement,
  type Adresse,
  type Formule,
} from '../../api/editions';
import { useAuth } from '../../auth/auth';
import { Chargement, MessageErreur } from '../../components/Etats';
import { formaterJour, formaterPrix } from '../../format';
import { useRessource } from '../../hooks/useRessource';
import { useTitre } from '../../hooks/useTitre';

function Statut({ abonnement }: { abonnement: Abonnement }) {
  if (!abonnement.plan || !abonnement.endsOn) return <p>Vous n'êtes pas abonné.</p>;
  return (
    <dl className="caracteristiques">
      <dt>Formule</dt>
      <dd>{abonnement.planLabel}</dd>
      <dt>Statut</dt>
      <dd>
        <span className={abonnement.active ? 'statut statut-confirmed' : 'statut statut-cancelled'}>
          {abonnement.active ? 'En cours' : 'Échu'}
        </span>
      </dd>
      <dt>{abonnement.active ? 'Échéance' : 'Échu le'}</dt>
      <dd>{formaterJour(abonnement.endsOn)}</dd>
      {abonnement.address && (
        <>
          <dt>Livraison</dt>
          <dd>
            {abonnement.address.recipient}, {abonnement.address.street}, {abonnement.address.postalCode}{' '}
            {abonnement.address.city}
          </dd>
        </>
      )}
    </dl>
  );
}

/** US17 — abonnement au fanzine (numérique, ou papier et numérique) et renouvellement. Paiement simulé. */
export function AbonnementPage() {
  useTitre('Abonnement au fanzine');
  const auth = useAuth();
  const abonnement = useRessource('abonnement', (signal) => lireAbonnement(auth.jeton, signal), { conserver: true });
  const formules = useRessource('formules', listerFormules);
  const [choix, setChoix] = useState<Formule>();
  const [annonce, setAnnonce] = useState('');
  const [erreur, setErreur] = useState<ApiError>();

  const actuel = abonnement.donnees;
  const formule = choix ?? actuel?.plan ?? 'DIGITAL';
  const papier = formules.donnees?.find((f) => f.code === formule)?.paper ?? false;
  const renouvellement = !!actuel?.plan;
  const possible = !renouvellement || actuel?.renewable === true;

  async function valider(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const donnees = new FormData(evenement.currentTarget);
    const champ = (nom: string) => String(donnees.get(nom) ?? '').trim();
    const adresse: Adresse | undefined = papier
      ? { recipient: champ('destinataire'), street: champ('rue'), postalCode: champ('codePostal'), city: champ('ville') }
      : undefined;
    setErreur(undefined);
    setAnnonce('');
    try {
      const resultat = await (renouvellement ? renouveler : sAbonner)(formule, adresse, auth.jeton);
      setAnnonce(
        `${renouvellement ? 'Abonnement renouvelé' : 'Abonnement souscrit'} : ${resultat.planLabel ?? ''}, jusqu'au ${
          resultat.endsOn ? formaterJour(resultat.endsOn) : ''
        }. Aucun paiement réel n'est demandé dans ce démonstrateur.`,
      );
      abonnement.recharger();
    } catch (e) {
      setErreur(versApiError(e));
    }
  }

  return (
    <>
      <p className="fil">
        <Link to="/fanzine">Le fanzine</Link>
      </p>
      <h1 tabIndex={-1}>Abonnement au fanzine</h1>
      <div role="status">{annonce && <p className="alerte alerte-succes">{annonce}</p>}</div>
      {abonnement.chargement && !actuel && <Chargement texte="Chargement de votre abonnement…" />}
      {abonnement.erreur && <MessageErreur erreur={abonnement.erreur} onReessayer={abonnement.recharger} />}
      {actuel && <Statut abonnement={actuel} />}
      {actuel && formules.donnees && (
        <form className="formulaire" onSubmit={(e) => void valider(e)}>
          <h2>{renouvellement ? 'Renouveler pour un an' : "S'abonner pour un an"}</h2>
          {!possible && actuel.endsOn && (
            <p className="note">
              Le renouvellement sera ouvert dans les 60 jours précédant l'échéance du {formaterJour(actuel.endsOn)}.
            </p>
          )}
          {erreur && <MessageErreur erreur={erreur} />}
          <fieldset disabled={!possible}>
            <legend>Formule</legend>
            {formules.donnees.map((f) => (
              <label key={f.code} className="case">
                <input
                  type="radio"
                  name="formule"
                  value={f.code}
                  checked={formule === f.code}
                  onChange={() => setChoix(f.code)}
                />
                {f.label} : {formaterPrix(f.priceCents)} par an
              </label>
            ))}
          </fieldset>
          {papier && possible && (
            <fieldset>
              <legend>Adresse de livraison du fanzine papier</legend>
              <label htmlFor="destinataire">Nom du destinataire</label>
              <input id="destinataire" name="destinataire" required maxLength={100} autoComplete="name"
                defaultValue={actuel.address?.recipient} />
              <label htmlFor="rue">Adresse</label>
              <input id="rue" name="rue" required maxLength={200} autoComplete="street-address"
                defaultValue={actuel.address?.street} />
              <label htmlFor="codePostal">Code postal (5 chiffres)</label>
              <input id="codePostal" name="codePostal" required pattern="[0-9]{5}" inputMode="numeric"
                autoComplete="postal-code" defaultValue={actuel.address?.postalCode} />
              <label htmlFor="ville">Ville</label>
              <input id="ville" name="ville" required maxLength={100} autoComplete="address-level2"
                defaultValue={actuel.address?.city} />
            </fieldset>
          )}
          <div className="actions">
            <button type="submit" className="bouton bouton-principal" disabled={!possible}>
              {renouvellement ? "Renouveler l'abonnement" : "S'abonner"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
