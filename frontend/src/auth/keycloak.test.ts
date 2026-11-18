import { beforeEach, describe, expect, it, vi } from 'vitest';
import { etatDepuisKeycloak, creerSourceKeycloak } from './keycloak';

const { FauxKeycloak, instances } = vi.hoisted(() => {
  const instances: InstanceType<typeof FauxKeycloak>[] = [];
  class FauxKeycloak {
    authenticated = false;
    token?: string;
    tokenParsed?: Record<string, unknown>;
    onAuthSuccess?: () => void;
    onAuthLogout?: () => void;
    onAuthRefreshSuccess?: () => void;
    onAuthRefreshError?: () => void;
    onTokenExpired?: () => void;
    init = vi.fn(async () => this.authenticated);
    login = vi.fn(async () => undefined);
    logout = vi.fn(async () => undefined);
    updateToken = vi.fn(async () => true);
    clearToken = vi.fn(async () => {
      this.authenticated = false;
      this.onAuthLogout?.();
    });
    constructor(readonly options: unknown) {
      instances.push(this);
    }
  }
  return { FauxKeycloak, instances };
});
type FauxKeycloak = InstanceType<typeof FauxKeycloak>;

vi.mock('keycloak-js', () => ({ default: FauxKeycloak }));

const CONFIG = { keycloakUrl: 'https://keycloak.pme.local:8443', realm: 'pme', clientId: 'pme-web' };

function connecter(kc: FauxKeycloak) {
  kc.authenticated = true;
  kc.token = 'jeton';
  kc.tokenParsed = { preferred_username: 'alice', realm_access: { roles: ['CUSTOMER'] } };
}

beforeEach(() => {
  instances.length = 0;
});

describe('etatDepuisKeycloak', () => {
  it('extrait le nom et les rôles du royaume', () => {
    expect(etatDepuisKeycloak(true, true, { preferred_username: 'alice', realm_access: { roles: ['CUSTOMER'] } })).toEqual(
      { pret: true, connecte: true, utilisateur: 'alice', roles: ['CUSTOMER'] },
    );
    expect(etatDepuisKeycloak(true, true, {})).toMatchObject({ roles: [] });
    expect(etatDepuisKeycloak(false, false)).toEqual({ pret: false, connecte: false, roles: [] });
  });
});

describe('creerSourceKeycloak', () => {
  it('initialise le flux code + PKCE S256 avec vérification silencieuse de session', async () => {
    const source = creerSourceKeycloak(CONFIG);
    const kc = instances[0]!;
    expect(kc.options).toEqual({ url: CONFIG.keycloakUrl, realm: 'pme', clientId: 'pme-web' });
    const rappel = vi.fn();
    source.abonner(rappel);
    expect(source.etat()).toEqual({ pret: false, connecte: false, roles: [] });
    kc.init.mockImplementation(async () => {
      connecter(kc);
      return true;
    });
    await source.demarrer();
    expect(kc.init).toHaveBeenCalledWith(
      expect.objectContaining({
        onLoad: 'check-sso',
        pkceMethod: 'S256',
        checkLoginIframe: false,
        silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
      }),
    );
    expect(source.etat()).toEqual({ pret: true, connecte: true, utilisateur: 'alice', roles: ['CUSTOMER'] });
    expect(rappel).toHaveBeenCalled();
  });

  it('reste utilisable sans connexion si Keycloak est injoignable', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const source = creerSourceKeycloak(CONFIG);
    instances[0]!.init.mockRejectedValue(new Error('timeout'));
    await source.demarrer();
    expect(source.etat()).toEqual({ pret: true, connecte: false, roles: [], echecConnexion: true });
    expect(await source.jeton()).toBeUndefined();
  });

  it('renouvelle le jeton avant chaque appel et oublie la session si le renouvellement échoue', async () => {
    const source = creerSourceKeycloak(CONFIG);
    const kc = instances[0]!;
    connecter(kc);
    await source.demarrer();
    expect(await source.jeton()).toBe('jeton');
    expect(kc.updateToken).toHaveBeenCalledWith(30);
    kc.updateToken.mockRejectedValueOnce(new Error('session expirée'));
    expect(await source.jeton()).toBeUndefined();
    expect(kc.clearToken).toHaveBeenCalled();
    expect(source.etat().connecte).toBe(false);
  });

  it('gère expiration et échec de rafraîchissement signalés par keycloak-js', async () => {
    const source = creerSourceKeycloak(CONFIG);
    const kc = instances[0]!;
    connecter(kc);
    await source.demarrer();
    kc.updateToken.mockRejectedValueOnce(new Error('refus'));
    kc.onTokenExpired?.();
    await vi.waitFor(() => expect(kc.clearToken).toHaveBeenCalledTimes(1));
    kc.onAuthRefreshError?.();
    expect(kc.clearToken).toHaveBeenCalledTimes(2);
  });

  it('redirige vers Keycloak pour la connexion et la déconnexion', () => {
    const source = creerSourceKeycloak(CONFIG);
    const kc = instances[0]!;
    source.connecter();
    expect(kc.login).toHaveBeenCalledWith({ redirectUri: window.location.href });
    source.deconnecter();
    expect(kc.logout).toHaveBeenCalledWith({ redirectUri: `${window.location.origin}/` });
  });

  it('permet de se désabonner', async () => {
    const source = creerSourceKeycloak(CONFIG);
    const rappel = vi.fn();
    const desabonner = source.abonner(rappel);
    desabonner();
    await source.demarrer();
    expect(rappel).not.toHaveBeenCalled();
  });
});
