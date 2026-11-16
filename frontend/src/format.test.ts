import { describe, expect, it } from 'vitest';
import { formaterDate, formaterPrix, numeroCourt } from './format';

const espace = /\s/gu;

describe('formatage', () => {
  it('affiche les prix en euros à la française', () => {
    expect(formaterPrix(123456).replace(espace, ' ')).toBe('1 234,56 €');
    expect(formaterPrix(990, 'EUR').replace(espace, ' ')).toBe('9,90 €');
  });

  it('affiche les dates en français et laisse une date invalide telle quelle', () => {
    expect(formaterDate('2026-11-16T10:00:00Z')).toMatch(/novembre 2026/);
    expect(formaterDate('pas une date')).toBe('pas une date');
  });

  it('abrège un identifiant de commande', () => {
    expect(numeroCourt('9a1b2c3d-1111-4222-8333-444455556666')).toBe('9A1B2C3D');
  });
});
