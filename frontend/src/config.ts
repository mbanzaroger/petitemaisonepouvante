/** Configuration propre à l'environnement, servie par nginx (/config.json) : aucune valeur codée dans le bundle. */
export interface AppConfig {
  keycloakUrl: string;
  realm: string;
  clientId: string;
}

export const CONFIG_PAR_DEFAUT: AppConfig = {
  keycloakUrl: 'http://localhost:8080',
  realm: 'pme',
  clientId: 'pme-web',
};

function estUrlHttp(valeur: unknown): valeur is string {
  if (typeof valeur !== 'string') return false;
  try {
    const url = new URL(valeur);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function estIdentifiant(valeur: unknown): valeur is string {
  return typeof valeur === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(valeur);
}

export async function chargerConfig(fetchImpl: typeof fetch = fetch): Promise<AppConfig> {
  try {
    const reponse = await fetchImpl('/config.json', { cache: 'no-store' });
    if (!reponse.ok) return CONFIG_PAR_DEFAUT;
    const brut = (await reponse.json()) as Record<string, unknown>;
    if (!estUrlHttp(brut.keycloakUrl) || !estIdentifiant(brut.realm) || !estIdentifiant(brut.clientId)) {
      console.warn('config.json invalide : configuration par défaut utilisée');
      return CONFIG_PAR_DEFAUT;
    }
    return { keycloakUrl: brut.keycloakUrl.replace(/\/+$/, ''), realm: brut.realm, clientId: brut.clientId };
  } catch {
    return CONFIG_PAR_DEFAUT;
  }
}
