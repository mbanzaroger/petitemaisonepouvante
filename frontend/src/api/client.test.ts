import { afterEach, describe, expect, it, vi } from 'vitest';
import { json, simulerApi } from '../test/outils';
import { listerCategories, listerProduits, lireProduit } from './catalogue';
import { ApiError, appelApi, messagePourStatut, nouvelIdCorrelation, versApiError } from './client';
import { listerCommandes, lireCommande, passerCommande } from './commandes';

afterEach(() => vi.unstubAllGlobals());

describe('appelApi', () => {
  it('ajoute le jeton Bearer et envoie le corps JSON', async () => {
    const fetch = simulerApi({ 'POST /api/v1/orders': () => json({ id: 'c1' }, 202) });
    await passerCommande([{ productId: 'p1', quantity: 2 }], async () => 'abc');
    const init = fetch.mock.calls[0]![1]!;
    expect(init.headers).toMatchObject({ Authorization: 'Bearer abc', 'Content-Type': 'application/json' });
    expect(JSON.parse(String(init.body))).toEqual({ lines: [{ productId: 'p1', quantity: 2 }] });
  });

  it("refuse l'appel sans jeton (utilisateur déconnecté) sans solliciter le réseau", async () => {
    const fetch = simulerApi({});
    await expect(listerCommandes(0, async () => undefined)).rejects.toMatchObject({ status: 401 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('affiche le détail problem+json des refus métier (422)', async () => {
    simulerApi({ 'POST /api/v1/orders': () => json({ status: 422, detail: 'Produit inconnu ou indisponible : x' }, 422) });
    await expect(passerCommande([], async () => 't')).rejects.toThrow('Produit inconnu ou indisponible : x');
  });

  it('remplace un 422 sans détail exploitable par un message générique', async () => {
    simulerApi({ 'POST /api/v1/orders': () => new Response('oups', { status: 422 }) });
    await expect(passerCommande([], async () => 't')).rejects.toThrow('La commande a été refusée.');
  });

  it("n'affiche jamais le détail technique des autres erreurs", async () => {
    simulerApi({ 'GET /api/v1/categories': () => json({ detail: 'stacktrace SQL' }, 500) });
    const erreur = await listerCategories().catch((e: unknown) => e);
    expect(erreur).toBeInstanceOf(ApiError);
    expect((erreur as ApiError).message).toBe('Une erreur est survenue côté serveur.');
  });

  it('traduit une panne réseau en message compréhensible (statut 0)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    await expect(lireProduit('p1')).rejects.toMatchObject({ status: 0 });
  });

  it("relaie l'annulation sans la transformer en erreur affichable", async () => {
    const controleur = new AbortController();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        controleur.abort();
        throw new DOMException('aborted', 'AbortError');
      }),
    );
    await expect(appelApi('/x', { signal: controleur.signal })).rejects.toBeInstanceOf(DOMException);
  });

  it('construit les URL du catalogue et des commandes', async () => {
    const fetch = simulerApi({
      'GET /api/v1/products': () => json({ content: [] }),
      'GET /api/v1/orders/c%201': () => json({}),
      'GET /api/v1/orders': () => json({ content: [] }),
    });
    await listerProduits({ page: 2, categorie: 'Blu-ray' });
    await listerProduits({});
    await listerCommandes(1, async () => 't');
    const urls = fetch.mock.calls.map(([url]) => String(url));
    expect(urls[0]).toBe('/api/v1/products?page=2&size=12&category=Blu-ray');
    expect(urls[1]).toBe('/api/v1/products?page=0&size=12');
    expect(urls[2]).toBe('/api/v1/orders?page=1&size=10');
    await expect(lireCommande('c 1', async () => 't')).resolves.toEqual({});
    expect(String(fetch.mock.calls[3]![0])).toBe('/api/v1/orders/c%201');
  });
});

describe('corrélation', () => {
  it('envoie un identifiant de corrélation par appel et le joint à l’erreur', async () => {
    const fetch = simulerApi({ 'GET /api/v1/categories': () => json({}, 503) });
    const erreur = (await listerCategories().catch((e: unknown) => e)) as ApiError;
    const envoye = (fetch.mock.calls[0]![1]!.headers as Record<string, string>)['X-Correlation-Id'];
    expect(envoye).toMatch(/^web-[A-Za-z0-9-]{1,60}$/);
    expect(erreur.correlationId).toBe(envoye);
  });

  it('reste valide pour les services (lettres, chiffres, tirets, 64 caractères au plus), même sans crypto.randomUUID', () => {
    expect(nouvelIdCorrelation()).toMatch(/^[A-Za-z0-9-]{1,64}$/);
    vi.stubGlobal('crypto', {});
    expect(nouvelIdCorrelation()).toMatch(/^web-[A-Za-z0-9-]{1,60}$/);
  });
});

describe('messages', () => {
  it.each([
    [401, 'reconnectez-vous'],
    [403, "n'a pas accès"],
    [404, 'introuvable'],
    [429, 'Trop de demandes'],
    [503, 'momentanément indisponible'],
    [418, 'La demande a échoué.'],
  ])('statut %i', (status, extrait) => {
    expect(messagePourStatut(status)).toContain(extrait);
  });

  it('conserve une ApiError existante', () => {
    const erreur = new ApiError(404, 'x');
    expect(versApiError(erreur)).toBe(erreur);
    expect(versApiError('autre').status).toBe(0);
  });
});
