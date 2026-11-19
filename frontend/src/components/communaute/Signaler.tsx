import { useId, useState, type FormEvent } from 'react';
import { versApiError, type ApiError } from '../../api/client';
import { signaler } from '../../api/communaute';
import { useAuth } from '../../auth/auth';
import { MessageErreur } from '../Etats';

interface Props {
  cible: 'LISTING' | 'MESSAGE';
  identifiant: string;
  /** Nom accessible de l'élément signalé (« l'annonce », « le message de carol »). */
  libelle: string;
}

/** Signalement d'un contenu inapproprié à la modération (US12), avec un motif obligatoire. */
export function Signaler({ cible, identifiant, libelle }: Props) {
  const auth = useAuth();
  const idMotif = useId();
  const [ouvert, setOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<ApiError>();

  async function envoyer(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    const motif = String(new FormData(evenement.currentTarget).get('motif') ?? '').trim();
    setEnvoi(true);
    setErreur(undefined);
    try {
      await signaler(cible, identifiant, motif, auth.jeton);
      setEnvoye(true);
      setOuvert(false);
    } catch (e) {
      setErreur(versApiError(e));
    } finally {
      setEnvoi(false);
    }
  }

  if (envoye) {
    return (
      <p role="status" className="note">
        Merci : la modération va examiner ce contenu.
      </p>
    );
  }
  if (!ouvert) {
    return (
      <button type="button" className="bouton bouton-lien" onClick={() => setOuvert(true)}>
        Signaler <span className="visuellement-masque">{libelle}</span>
      </button>
    );
  }
  return (
    <form className="formulaire formulaire-compact" onSubmit={(e) => void envoyer(e)}>
      {erreur && <MessageErreur erreur={erreur} />}
      <label htmlFor={idMotif}>
        Motif du signalement <span className="visuellement-masque">de {libelle}</span>
      </label>
      <textarea id={idMotif} name="motif" required minLength={3} maxLength={500} rows={2} />
      <div className="actions">
        <button type="submit" className="bouton" disabled={envoi}>
          Envoyer le signalement
        </button>
        <button type="button" className="bouton bouton-secondaire" onClick={() => setOuvert(false)}>
          Annuler
        </button>
      </div>
    </form>
  );
}
