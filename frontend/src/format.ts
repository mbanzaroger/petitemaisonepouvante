import type { OrderStatus } from './api/types';

const formatteurs = new Map<string, Intl.NumberFormat>();

export function formaterPrix(centimes: number, devise = 'EUR'): string {
  let formatteur = formatteurs.get(devise);
  if (!formatteur) {
    formatteur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: devise });
    formatteurs.set(devise, formatteur);
  }
  return formatteur.format(centimes / 100);
}

const formatDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });

export function formaterDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : formatDate.format(date);
}

export const LIBELLES_STATUT: Record<OrderStatus, string> = {
  PENDING: 'En attente de confirmation',
  CONFIRMED: 'Confirmée',
  CANCELLED: 'Annulée',
};

/** Numéro court lisible (8 premiers caractères de l'identifiant). */
export function numeroCourt(id: string): string {
  return id.slice(0, 8).toUpperCase();
}
