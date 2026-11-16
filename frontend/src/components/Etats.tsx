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
      {onReessayer && (
        <button type="button" className="bouton bouton-secondaire" onClick={onReessayer}>
          Réessayer
        </button>
      )}
    </div>
  );
}
