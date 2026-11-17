import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErreurInattendue } from './ErreurInattendue';

function Panne(): never {
  throw new Error('panne de rendu');
}

describe('ErreurInattendue', () => {
  it('remplace une page en erreur par un message et propose de recharger', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const recharger = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload: recharger });
    render(
      <ErreurInattendue>
        <Panne />
      </ErreurInattendue>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Une erreur inattendue est survenue' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Votre panier est conservé.');
    await userEvent.click(screen.getByRole('button', { name: 'Recharger la page' }));
    expect(recharger).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('laisse passer une page sans erreur', () => {
    render(
      <ErreurInattendue>
        <p>Contenu</p>
      </ErreurInattendue>,
    );
    expect(screen.getByText('Contenu')).toBeInTheDocument();
  });
});
