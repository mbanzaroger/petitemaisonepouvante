import type { TokenProvider } from './types';

/** Erreur d'appel à l'API, avec un message destiné à l'utilisateur (en français). */
export class ApiError extends Error {
  readonly status: number;
  /** Identifiant de corrélation de l'appel (journaux des services), à communiquer au support. */
  readonly correlationId?: string;

  constructor(status: number, message: string, correlationId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.correlationId = correlationId;
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

/**
 * Identifiant de corrélation envoyé à chaque appel (en-tête X-Correlation-Id) : les services le placent dans
 * leurs journaux et le propagent dans les événements de la saga (docs/12). Préfixe « web- » : appel du site.
 */
export function nouvelIdCorrelation(): string {
  const aleatoire =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `web-${aleatoire}`;
}

/** Statuts dont le détail problem+json (RFC 9457) est rédigé pour l'utilisateur par les services. */
const DETAIL_AFFICHE = new Set([409, 422, 429]);

/** Le détail problem+json n'est affiché que pour les conflits, refus métier et limitations (textes des services). */
async function erreurDepuisReponse(reponse: Response, correlationId: string): Promise<ApiError> {
  if (DETAIL_AFFICHE.has(reponse.status)) {
    try {
      const probleme = (await reponse.json()) as { detail?: unknown };
      if (typeof probleme.detail === 'string' && probleme.detail.length > 0) {
        return new ApiError(reponse.status, probleme.detail, correlationId);
      }
    } catch {
      // corps absent ou non JSON : message générique
    }
  }
  if (reponse.status === 422) return new ApiError(422, 'La demande a été refusée.', correlationId);
  if (reponse.status === 409) {
    return new ApiError(409, "Cette action n'est plus possible : la page a changé entre-temps.", correlationId);
  }
  return new ApiError(reponse.status, messagePourStatut(reponse.status), correlationId);
}

export function versApiError(erreur: unknown): ApiError {
  if (erreur instanceof ApiError) return erreur;
  return new ApiError(0, 'Impossible de joindre le serveur : vérifiez votre connexion.');
}

interface Options {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: TokenProvider;
  signal?: AbortSignal;
}

export async function appelApi<T>(chemin: string, { method = 'GET', body, token, signal }: Options = {}): Promise<T> {
  const correlationId = nouvelIdCorrelation();
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Correlation-Id': correlationId };
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
    throw new ApiError(0, versApiError(erreur).message, correlationId);
  }
  if (!reponse.ok) throw await erreurDepuisReponse(reponse, correlationId);
  // Réponses sans corps (204, ou 202 d'un signalement) : rien à décoder.
  if (reponse.status === 204) return undefined as T;
  const texte = await reponse.text();
  return (texte.length > 0 ? JSON.parse(texte) : undefined) as T;
}
