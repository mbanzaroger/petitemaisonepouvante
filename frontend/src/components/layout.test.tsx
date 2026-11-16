import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLIENT, fausseAuth, json, page, produit, rendreApp, simulerApi } from '../test/outils';

afterEach(() => vi.unstubAllGlobals());

function api() {
  simulerApi({
    'GET /api/v1/categories': () => json([]),
    'GET /api/v1/products': () => json(page([produit(1)])),
    'GET /api/v1/orders': () => json(page([], 0, 0, 0)),
  });
}

describe('Gabarit', () => {
  it('propose un lien d’évitement vers le contenu principal', () => {
    api();
    rendreApp('/');
    expect(screen.getByRole('link', { name: 'Aller au contenu' })).toHaveAttribute('href', '#contenu');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'contenu');
  });

  it('montre « Mes commandes » et la déconnexion à un utilisateur connecté', async () => {
    api();
    const auth = fausseAuth(CLIENT);
    const { utilisateur } = rendreApp('/', auth);
    const navigation = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(navigation).getByRole('link', { name: 'Mes commandes' })).toBeInTheDocument();
    expect(screen.getByText('Bonjour alice')).toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    expect(auth.deconnecter).toHaveBeenCalled();
  });

  it('ne montre ni connexion ni déconnexion pendant la vérification de session', () => {
    api();
    rendreApp('/', fausseAuth({ pret: false }));
    expect(screen.queryByRole('button', { name: /Se (dé)?connecter/ })).not.toBeInTheDocument();
  });

  it('place le focus sur le titre de la page après une navigation et marque le lien actif', async () => {
    api();
    const { utilisateur } = rendreApp('/', fausseAuth(CLIENT));
    const navigation = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(navigation).getByRole('link', { name: 'Catalogue' })).toHaveAttribute('aria-current', 'page');
    await utilisateur.click(within(navigation).getByRole('link', { name: 'Mes commandes' }));
    const titre = await screen.findByRole('heading', { level: 1, name: 'Mes commandes' });
    expect(titre).toHaveFocus();
    expect(within(navigation).getByRole('link', { name: 'Mes commandes' })).toHaveAttribute('aria-current', 'page');
  });

  it('affiche une page introuvable pour une adresse inconnue', () => {
    api();
    rendreApp('/nimporte-quoi');
    expect(screen.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeInTheDocument();
  });
});
