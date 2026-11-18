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
    const entete = screen.getByRole('banner');
    expect(within(entete).getByText('alice')).toBeInTheDocument();
    expect(within(entete).getByText('Client')).toBeInTheDocument();
    await utilisateur.click(screen.getByRole('button', { name: 'Se déconnecter' }));
    expect(auth.deconnecter).toHaveBeenCalled();
  });

  it.each([
    [{ connecte: true, utilisateur: 'admin-pme', roles: ['ADMIN'] }, 'Administrateur'],
    [{ connecte: true, utilisateur: 'bob', roles: [] }, 'Sans profil client'],
  ])('indique le profil du compte connecté (%o)', (etat, profil) => {
    api();
    rendreApp('/', fausseAuth(etat));
    const entete = screen.getByRole('banner');
    expect(within(entete).getByText(etat.utilisateur)).toBeInTheDocument();
    expect(within(entete).getByText(profil)).toBeInTheDocument();
  });

  it("donne accès à l'espace communautaire selon le profil", async () => {
    simulerApi({
      'GET /api/v1/categories': () => json([]),
      'GET /api/v1/products': () => json(page([produit(1)])),
      'GET /api/v1/community/notifications/unread-count': () => json({ unread: 3 }),
    });
    rendreApp('/', fausseAuth({ connecte: true, utilisateur: 'admin-pme', roles: ['ADMIN'] }));
    const navigation = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(navigation).getByRole('link', { name: 'Troc et dons' })).toHaveAttribute('href', '/communaute');
    expect(within(navigation).getByRole('link', { name: 'Salons' })).toBeInTheDocument();
    expect(within(navigation).getByRole('link', { name: 'Modération' })).toHaveAttribute('href', '/admin/moderation');
    expect(within(navigation).queryByRole('link', { name: 'Mes commandes' })).not.toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Mon espace (3 notifications non lues)' })).toHaveAttribute(
      'href',
      '/mon-espace',
    );
  });

  it("n'affiche ni salons ni espace personnel à un compte sans profil", () => {
    api();
    rendreApp('/', fausseAuth({ connecte: true, utilisateur: 'bob', roles: [] }));
    const navigation = screen.getByRole('navigation', { name: 'Navigation principale' });
    expect(within(navigation).getByRole('link', { name: 'Troc et dons' })).toBeInTheDocument();
    expect(within(navigation).queryByRole('link', { name: 'Salons' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Mon espace/ })).not.toBeInTheDocument();
  });

  it('prévient quand la connexion ne peut pas être établie', () => {
    api();
    rendreApp('/', fausseAuth({ echecConnexion: true }));
    expect(screen.getByRole('alert')).toHaveTextContent("La connexion n'a pas pu être établie");
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
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
