import { appelApi } from './client';
import type { Page, TokenProvider } from './types';

// Contrats de community-service (docs/api/openapi.yaml) : mêmes noms de champs que les DTO du service.

export type TypeAnnonce = 'EXCHANGE' | 'GIFT';
export type Categorie = 'FIGURINES' | 'BLURAY' | 'BOARD_GAMES' | 'BOOKS_COMICS' | 'POSTERS' | 'GOODIES' | 'OTHER';
export type EtatObjet = 'NEW' | 'LIKE_NEW' | 'GOOD' | 'USED';
export type StatutAnnonce = 'ACTIVE' | 'CONCLUDED' | 'WITHDRAWN' | 'HIDDEN';
export type StatutProposition = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED';
export type DecisionProposition = 'acceptance' | 'decline' | 'cancellation';
export type TypeNotification =
  | 'NEW_OFFER'
  | 'OFFER_ACCEPTED'
  | 'OFFER_DECLINED'
  | 'OFFER_CANCELLED'
  | 'NEW_MESSAGE'
  | 'WISH_MATCH'
  | 'CONTENT_HIDDEN';
export type StatutSignalement = 'OPEN' | 'ACTIONED' | 'DISMISSED';

export const TYPES: Record<TypeAnnonce, string> = { EXCHANGE: 'Échange', GIFT: 'Don' };
export const CATEGORIES: Record<Categorie, string> = {
  FIGURINES: 'Figurines',
  BLURAY: 'Films et Blu-ray',
  BOARD_GAMES: 'Jeux de société',
  BOOKS_COMICS: 'Livres et BD',
  POSTERS: 'Affiches',
  GOODIES: 'Goodies',
  OTHER: 'Autre',
};
export const ETATS: Record<EtatObjet, string> = {
  NEW: 'Neuf',
  LIKE_NEW: 'Comme neuf',
  GOOD: 'Bon état',
  USED: 'Usagé',
};
export const STATUTS_ANNONCE: Record<StatutAnnonce, string> = {
  ACTIVE: 'En cours',
  CONCLUDED: 'Conclue',
  WITHDRAWN: 'Retirée',
  HIDDEN: 'Masquée par la modération',
};
export const STATUTS_PROPOSITION: Record<StatutProposition, string> = {
  PENDING: 'En attente de réponse',
  ACCEPTED: 'Acceptée',
  DECLINED: 'Déclinée',
  CANCELLED: 'Annulée',
};

export interface Annonce {
  id: string;
  type: TypeAnnonce;
  title: string;
  description: string;
  category: Categorie;
  condition: EtatObjet;
  wanted: string | null;
  status: StatutAnnonce;
  ownerName: string;
  mine: boolean;
  createdAt: string;
}

export interface NouvelleAnnonce {
  type: TypeAnnonce;
  title: string;
  description: string;
  category: Categorie;
  condition: EtatObjet;
  wanted?: string;
}

export interface Proposition {
  id: string;
  listingId: string;
  listingTitle: string;
  listingStatus: StatutAnnonce;
  status: StatutProposition;
  message: string;
  authorName: string;
  ownerName: string;
  /** Proposition faite par le membre connecté (sinon : reçue sur une de ses annonces). */
  sent: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MesPropositions {
  sent: Proposition[];
  received: Proposition[];
}

export interface Message {
  id: number;
  author: string;
  content: string;
  sentAt: string;
  mine: boolean;
}

export interface Salon {
  code: string;
  name: string;
  description: string;
}

export interface Notification {
  id: number;
  type: TypeNotification;
  text: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface Preferences {
  offers: boolean;
  messages: boolean;
  wishes: boolean;
}

export interface Recherche {
  id: string;
  keywords: string;
  createdAt: string;
}

export interface Signalement {
  id: string;
  targetType: 'LISTING' | 'MESSAGE';
  targetId: string;
  excerpt: string | null;
  targetAuthorName: string | null;
  reporterName: string;
  reason: string;
  status: StatutSignalement;
  createdAt: string;
  handledBy: string | null;
  handledAt: string | null;
}

const API = '/api/v1/community';
export const TAILLE_PAGE_ANNONCES = 12;

const id = (valeur: string) => encodeURIComponent(valeur);

export interface FiltresAnnonces {
  type?: TypeAnnonce;
  category?: Categorie;
  q?: string;
  page: number;
}

/** Lecture publique ; le jeton (facultatif) permet de reconnaître les annonces du membre connecté (« mine »). */
export function listerAnnonces(filtres: FiltresAnnonces, token?: TokenProvider, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(filtres.page), size: String(TAILLE_PAGE_ANNONCES) });
  if (filtres.type) params.set('type', filtres.type);
  if (filtres.category) params.set('category', filtres.category);
  if (filtres.q) params.set('q', filtres.q);
  return appelApi<Page<Annonce>>(`${API}/listings?${params.toString()}`, { token, signal });
}

export function lireAnnonce(annonce: string, token?: TokenProvider, signal?: AbortSignal) {
  return appelApi<Annonce>(`${API}/listings/${id(annonce)}`, { token, signal });
}

export function publierAnnonce(annonce: NouvelleAnnonce, token: TokenProvider) {
  return appelApi<Annonce>(`${API}/listings`, { method: 'POST', body: annonce, token });
}

export function mesAnnonces(token: TokenProvider, signal?: AbortSignal) {
  return appelApi<Annonce[]>(`${API}/listings/mine`, { token, signal });
}

export function retirerAnnonce(annonce: string, token: TokenProvider) {
  return appelApi<undefined>(`${API}/listings/${id(annonce)}/withdrawal`, { method: 'POST', token });
}

export function proposer(annonce: string, message: string, token: TokenProvider) {
  return appelApi<Proposition>(`${API}/listings/${id(annonce)}/offers`, { method: 'POST', body: { message }, token });
}

export function mesPropositions(token: TokenProvider, signal?: AbortSignal) {
  return appelApi<MesPropositions>(`${API}/offers`, { token, signal });
}

export function lireProposition(proposition: string, token: TokenProvider, signal?: AbortSignal) {
  return appelApi<Proposition>(`${API}/offers/${id(proposition)}`, { token, signal });
}

export function deciderProposition(proposition: string, decision: DecisionProposition, token: TokenProvider) {
  return appelApi<Proposition>(`${API}/offers/${id(proposition)}/${decision}`, { method: 'POST', token });
}

export function messagesProposition(proposition: string, apres: number, token: TokenProvider, signal?: AbortSignal) {
  return appelApi<Message[]>(`${API}/offers/${id(proposition)}/messages?after=${apres}`, { token, signal });
}

export function ecrireProposition(proposition: string, contenu: string, token: TokenProvider) {
  return appelApi<Message>(`${API}/offers/${id(proposition)}/messages`, {
    method: 'POST',
    body: { content: contenu },
    token,
  });
}

export function listerSalons(token: TokenProvider, signal?: AbortSignal) {
  return appelApi<Salon[]>(`${API}/rooms`, { token, signal });
}

export function messagesSalon(salon: string, apres: number, token: TokenProvider, signal?: AbortSignal) {
  return appelApi<Message[]>(`${API}/rooms/${id(salon)}/messages?after=${apres}`, { token, signal });
}

export function ecrireSalon(salon: string, contenu: string, token: TokenProvider) {
  return appelApi<Message>(`${API}/rooms/${id(salon)}/messages`, { method: 'POST', body: { content: contenu }, token });
}

export function listerNotifications(token: TokenProvider, signal?: AbortSignal) {
  return appelApi<Notification[]>(`${API}/notifications`, { token, signal });
}

export function compterNonLues(token: TokenProvider, signal?: AbortSignal) {
  return appelApi<{ unread: number }>(`${API}/notifications/unread-count`, { token, signal });
}

export function toutMarquerLu(token: TokenProvider) {
  return appelApi<undefined>(`${API}/notifications/read`, { method: 'POST', token });
}

export function lirePreferences(token: TokenProvider, signal?: AbortSignal) {
  return appelApi<Preferences>(`${API}/preferences`, { token, signal });
}

export function enregistrerPreferences(preferences: Preferences, token: TokenProvider) {
  return appelApi<Preferences>(`${API}/preferences`, { method: 'PUT', body: preferences, token });
}

export function listerRecherches(token: TokenProvider, signal?: AbortSignal) {
  return appelApi<Recherche[]>(`${API}/wishes`, { token, signal });
}

export function ajouterRecherche(motsCles: string, token: TokenProvider) {
  return appelApi<Recherche>(`${API}/wishes`, { method: 'POST', body: { keywords: motsCles }, token });
}

export function supprimerRecherche(recherche: string, token: TokenProvider) {
  return appelApi<undefined>(`${API}/wishes/${id(recherche)}`, { method: 'DELETE', token });
}

export function signaler(cible: 'LISTING' | 'MESSAGE', identifiant: string, motif: string, token: TokenProvider) {
  return appelApi<undefined>(`${API}/reports`, {
    method: 'POST',
    body: { targetType: cible, targetId: identifiant, reason: motif },
    token,
  });
}

export function listerSignalements(statut: StatutSignalement, token: TokenProvider, signal?: AbortSignal) {
  return appelApi<Signalement[]>(`${API}/moderation/reports?status=${statut}`, { token, signal });
}

export function moderer(signalement: string, decision: 'hide' | 'dismiss', token: TokenProvider) {
  return appelApi<undefined>(`${API}/moderation/reports/${id(signalement)}/${decision}`, { method: 'POST', token });
}
