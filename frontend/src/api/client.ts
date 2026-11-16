import type { TokenProvider } from './types';

/** Erreur d'appel à l'API, avec un message destiné à l'utilisateur (en français). */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const MESSAGES: Record<number, string> = {
  400: 'La demande est invalide.',
  401: 'Votre session a expiré : reconnectez-vous.',
  403: "Votre compte n'a pas accès à cette fonctionnalité.",
  404: 'Élément introuvable.',
  429: 'Trop de demandes en peu de temps : réessayez dans un instant.',
  503: 'Le service est momentanément indisponible : réessayez dans un instant.',
};

export function messagePourStatut(status: number): string {
  return MESSAGES[status] ?? (status >= 500 ? 'Une erreur est survenue côté serveur.' : 'La demande a échoué.');
}

/** Le détail problem+json (RFC 9457) n'est affiché que pour les refus métier (422), rédigés pour l'utilisateur. */
async function erreurDepuisReponse(reponse: Response): Promise<ApiError> {
  if (reponse.status === 422) {
    try {
      const probleme = (await reponse.json()) as { detail?: unknown };
      if (typeof probleme.detail === 'string' && probleme.detail.length > 0) {
        return new ApiError(422, probleme.detail);
      }
    } catch {
      // corps absent ou non JSON : message générique
    }
    return new ApiError(422, 'La commande a été refusée.');
  }
  return new ApiError(reponse.status, messagePourStatut(reponse.status));
}

export function versApiError(erreur: unknown): ApiError {
  if (erreur instanceof ApiError) return erreur;
  return new ApiError(0, 'Impossible de joindre le serveur : vérifiez votre connexion.');
}

interface Options {
  method?: 'GET' | 'POST';
  body?: unknown;
  token?: TokenProvider;
  signal?: AbortSignal;
}

export async function appelApi<T>(chemin: string, { method = 'GET', body, token, signal }: Options = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) {
    const jeton = await token();
    if (!jeton) throw new ApiError(401, messagePourStatut(401));
    headers.Authorization = `Bearer ${jeton}`;
  }
  let reponse: Response;
  try {
    reponse = await fetch(chemin, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      credentials: 'same-origin',
    });
  } catch (erreur) {
    if (signal?.aborted) throw erreur;
    throw versApiError(erreur);
  }
  if (!reponse.ok) throw await erreurDepuisReponse(reponse);
  return (await reponse.json()) as T;
}
