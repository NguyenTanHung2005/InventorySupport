import { AppNotification, InventorySummary, Paginated, Product, StockTransaction, StockType } from '../types';
import { request } from './api';

export interface TransactionQuery {
  page?: number;
  limit?: number;
  productId?: string;
  type?: StockType;
  from?: string;
  to?: string;
}

export const inventoryService = {
  move: (token: string, input: { productId: string; type: StockType; quantity: number; reason?: string }) =>
    request<{ product: Product; transaction: StockTransaction; alert?: AppNotification }>('/inventory/movement', {
      method: 'POST',
      token,
      body: input,
    }),

  lowStock: (token: string) => request<Product[]>('/inventory/low-stock', { token }),

  transactions: (token: string, query: TransactionQuery = {}) =>
    request<Paginated<StockTransaction>>('/inventory/transactions', { token, query: { ...query } }),

  summary: (token: string, query: { from?: string; to?: string } = {}) =>
    request<InventorySummary>('/inventory/summary', { token, query }),
};
