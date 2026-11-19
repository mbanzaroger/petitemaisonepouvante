// Contrats de l'API (docs/api) : mêmes noms de champs que les DTO des services.
export interface Money {
  amountCents: number;
  currency: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string;
  price: Money;
  category: string;
  available: boolean;
  /** Vendu en exclusivité sur le site (gamme de figurines du collectif Evil Ed). */
  exclusive: boolean;
}

export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';

export interface OrderLine {
  productId: string;
  productName: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
}

export interface Order {
  id: string;
  status: OrderStatus;
  totalCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  lines: OrderLine[];
}

export interface OrderLineRequest {
  productId: string;
  quantity: number;
}

/** Fournit un jeton d'accès à jour (ou undefined si l'utilisateur n'est pas connecté). */
export type TokenProvider = () => Promise<string | undefined>;
