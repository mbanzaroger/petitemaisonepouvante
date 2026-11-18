import { useId, useRef, useState, type FormEvent } from 'react';
import { versApiError, type ApiError } from '../../api/client';
import type { Message } from '../../api/communaute';
import { formaterDate } from '../../format';
import { MessageErreur } from '../Etats';
import { Signaler } from './Signaler';

interface Props {
  /** Nom de la zone de messages (lecteurs d'écran). */
  titre: string;
  messages: Message[];
  charge: boolean;
  erreur?: ApiError;
  /** Envoi d'un message ; absent quand la conversation est close. */
  envoyer?: (contenu: string) => Promise<Message>;
  ajouter: (message: Message) => void;
  /** Texte affiché à la place du formulaire quand l'envoi n'est pas possible. */
  fermee?: string;
  vide?: string;
}

/**
 * Fil de discussion (salon ou proposition). La zone a le rôle « log » : les lecteurs d'écran annoncent les nouveaux
 * messages sans déplacer le focus. Le texte des messages est affiché tel quel (échappé par React, jamais interprété).
 */
export function Discussion({ titre, messages, charge, erreur, envoyer, ajouter, fermee, vide }: Props) {
  const idSaisie = useId();
  const formulaire = useRef<HTMLFormElement>(null);
  const [envoi, setEnvoi] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<ApiError>();

  async function soumettre(evenement: FormEvent<HTMLFormElement>) {
    evenement.preventDefault();
    if (!envoyer) return;
    const contenu = String(new FormData(evenement.currentTarget).get('contenu') ?? '').trim();
    if (!contenu) return;
    setEnvoi(true);
    setErreurEnvoi(undefined);
    try {
      ajouter(await envoyer(contenu));
      formulaire.current?.reset();
    } catch (e) {
      setErreurEnvoi(versApiError(e));
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <section className="discussion" aria-label={titre}>
      {erreur && <MessageErreur erreur={erreur} />}
      <div role="log" aria-label={`Messages : ${titre}`} className="messages">
        <ol>
          {messages.map((message) => (
            <li key={message.id} className={message.mine ? 'message message-moi' : 'message'}>
              <p className="message-entete">
                <strong>{message.mine ? 'Vous' : message.author}</strong>{' '}
                <span className="note">{formaterDate(message.sentAt)}</span>
              </p>
              <p className="message-texte">{message.content}</p>
              {!message.mine && (
                <Signaler cible="MESSAGE" identifiant={String(message.id)} libelle={`le message de ${message.author}`} />
              )}
            </li>
          ))}
        </ol>
      </div>
      {charge && messages.length === 0 && !erreur && <p>{vide ?? 'Aucun message pour le moment.'}</p>}
      {envoyer ? (
        <form ref={formulaire} className="formulaire" onSubmit={(e) => void soumettre(e)}>
          {erreurEnvoi && <MessageErreur erreur={erreurEnvoi} />}
          <label htmlFor={idSaisie}>Votre message</label>
          <textarea id={idSaisie} name="contenu" required maxLength={1000} rows={3} />
          <div className="actions">
            <button type="submit" className="bouton" disabled={envoi}>
              {envoi ? 'Envoi…' : 'Envoyer'}
            </button>
          </div>
        </form>
      ) : (
        fermee && <p className="note">{fermee}</p>
      )}
    </section>
  );
}
