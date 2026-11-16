import { describe, expect, it, vi } from 'vitest';
import { CONFIG_PAR_DEFAUT, chargerConfig } from './config';

function reponse(corps: unknown, ok = true) {
  return vi.fn(async () => new Response(JSON.stringify(corps), { status: ok ? 200 : 500 })) as unknown as typeof fetch;
}

describe('chargerConfig', () => {
  it('lit config.json servi par nginx et retire la barre finale', async () => {
    const config = await chargerConfig(
      reponse({ keycloakUrl: 'https://keycloak.pme.local:8443/', realm: 'pme', clientId: 'pme-web' }),
    );
    expect(config).toEqual({ keycloakUrl: 'https://keycloak.pme.local:8443', realm: 'pme', clientId: 'pme-web' });
  });

  it('rejette une URL non HTTP et revient à la configuration par défaut', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const config = await chargerConfig(reponse({ keycloakUrl: 'javascript:alert(1)', realm: 'pme', clientId: 'pme-web' }));
    expect(config).toEqual(CONFIG_PAR_DEFAUT);
  });

  it('rejette un identifiant de royaume inattendu', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const config = await chargerConfig(reponse({ keycloakUrl: 'https://kc', realm: '../admin', clientId: 'pme-web' }));
    expect(config).toEqual(CONFIG_PAR_DEFAUT);
  });

  it('utilise la configuration par défaut si le fichier est absent ou illisible', async () => {
    expect(await chargerConfig(reponse({}, false))).toEqual(CONFIG_PAR_DEFAUT);
    const enPanne = vi.fn(async () => {
      throw new TypeError('réseau');
    }) as unknown as typeof fetch;
    expect(await chargerConfig(enPanne)).toEqual(CONFIG_PAR_DEFAUT);
  });
});
