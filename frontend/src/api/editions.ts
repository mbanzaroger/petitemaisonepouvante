import { appelApi } from './client';
import type { Page, TokenProvider } from './types';

// Contrats d'editorial-service (docs/api/openapi.yaml).

export type TypeArticle = 'NEWS' | 'FEATURE';
export type AccesNumero = 'PREVIEW' | 'PURCHASE' | 'SUBSCRIPTION';
export type Formule = 'DIGITAL' | 'PAPER_DIGITAL';

export const TYPES_ARTICLE: Record<TypeArticle, string> = { NEWS: 'Actualité', FEATURE: 'Article de fond' };

export interface ResumeArticle {
  id: string;
  slug: string;
  kind: TypeArticle;
  title: string;
  summary: string;
  author: string;
  publishedAt: string;
}

export interface Article extends ResumeArticle {
  body: string;
}

export interface Numero {
  number: number;
  title: string;
  summary: string;
  publishedOn: string;
  priceCents: number;
  pageCount: number;
  access: AccesNumero;
}

export interface DetailNumero {
  issue: Numero;
  contents: string[];
}

export interface PageNumero {
  issueNumber: number;
  pageNo: number;
  pageCount: number;
  title: string;
  content: string;
  access: AccesNumero;
}

export interface ElementBibliotheque {
  issue: Numero;
  purchasedAt: string | null;
  lastPage: number;
}

export interface FormuleAbonnement {
  code: Formule;
  label: string;
  priceCents: number;
  paper: boolean;
}

export interface Adresse {
  recipient: string;
  street: string;
  postalCode: string;
  city: string;
}

export interface Abonnement {
  active: boolean;
  plan: Formule | null;
  planLabel: string | null;
  startsOn: string | null;
  endsOn: string | null;
  renewable: boolean;
  address: Adresse | null;
}

export interface AbonnePapier {
  memberName: string;
  address: Adresse;
  endsOn: string;
}

const API = '/api/v1/editorial';
export const TAILLE_PAGE_ARTICLES = 10;

export function listerArticles(type: TypeArticle | undefined, page: number, signal?: AbortSignal) {
  const params = new URLSearchParams({ page: String(page), size: String(TAILLE_PAGE_ARTICLES) });
  if (type) params.set('kind', type);
  return appelApi<Page<ResumeArticle>>(`${API}/articles?${params.toString()}`, { signal });
}

export function lireArticle(slug: string, signal?: AbortSignal) {
  return appelApi<Article>(`${API}/articles/${encodeURIComponent(slug)}`, { signal });
}

/** Le jeton (facultatif) indique pour chaque numéro s'il est acheté ou inclus dans l'abonnement du membre. */
export function listerNumeros(token?: TokenProvider, signal?: AbortSignal) {
  return appelApi<Numero[]>(`${API}/issues`, { token, signal });
}

export function lireNumero(numero: number, token?: TokenProvider, signal?: AbortSignal) {
  return appelApi<DetailNumero>(`${API}/issues/${numero}`, { token, signal });
}

export function lirePage(numero: number, page: number, token?: TokenProvider, signal?: AbortSignal) {
  return appelApi<PageNumero>(`${API}/issues/${numero}/pages/${page}`, { token, signal });
}

export function acheterNumero(numero: number, token: TokenProvider) {
  return appelApi<Numero>(`${API}/issues/${numero}/purchase`, { method: 'POST', token });
}

export function lireBibliotheque(token: TokenProvider, signal?: AbortSignal) {
  return appelApi<ElementBibliotheque[]>(`${API}/library`, { token, signal });
}

export function enregistrerProgression(numero: number, page: number, token: TokenProvider) {
  return appelApi<undefined>(`${API}/library/${numero}/progress`, { method: 'PUT', body: { page }, token });
}

export function listerFormules(signal?: AbortSignal) {
  return appelApi<FormuleAbonnement[]>(`${API}/plans`, { signal });
}

export function lireAbonnement(token: TokenProvider, signal?: AbortSignal) {
  return appelApi<Abonnement>(`${API}/subscription`, { token, signal });
}

export function sAbonner(formule: Formule, adresse: Adresse | undefined, token: TokenProvider) {
  return appelApi<Abonnement>(`${API}/subscription`, {
    method: 'POST',
    body: { plan: formule, address: adresse },
    token,
  });
}

export function renouveler(formule: Formule, adresse: Adresse | undefined, token: TokenProvider) {
  return appelApi<Abonnement>(`${API}/subscription/renewal`, {
    method: 'POST',
    body: { plan: formule, address: adresse },
    token,
  });
}

export function publierArticle(
  article: { kind: TypeArticle; title: string; summary: string; body: string },
  token: TokenProvider,
) {
  return appelApi<Article>(`${API}/admin/articles`, { method: 'POST', body: article, token });
}

export function retirerArticle(id: string, token: TokenProvider) {
  return appelApi<undefined>(`${API}/admin/articles/${encodeURIComponent(id)}/unpublish`, { method: 'POST', token });
}

export function listerAbonnesPapier(token: TokenProvider, signal?: AbortSignal) {
  return appelApi<AbonnePapier[]>(`${API}/admin/paper-subscribers`, { token, signal });
}
