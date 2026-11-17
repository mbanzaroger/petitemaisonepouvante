import type { ApiError } from '../api/client';

export function Chargement({ texte = 'Chargement…' }: { texte?: string }) {
  return (
    <p role="status" className="chargement">
      {texte}
    </p>
  );
}

export function MessageErreur({ erreur, onReessayer }: { erreur: ApiError; onReessayer?: () => void }) {
  return (
    <div role="alert" className="alerte alerte-erreur">
      <p>{erreur.message}</p>
      {erreur.correlationId && erreur.status !== 401 && erreur.status !== 422 && (
        <p className="reference">
          Si le problème persiste, communiquez cette référence au support : <code>{erreur.correlationId}</code>
        </p>
      )}
      {onReessayer && (
        <button type="button" className="bouton bouton-secondaire" onClick={onReessayer}>
          Réessayer
        </button>
      )}
    </div>
  );
}
