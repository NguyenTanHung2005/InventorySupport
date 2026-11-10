import { Paginated, Product, ProductInput } from '../types';
import { request } from './api';

export interface ProductQuery {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  lowStock?: boolean;
  sort?: 'name' | 'quantity' | 'updatedAt';
}

export const productService = {
  list: (token: string, query: ProductQuery = {}) =>
    request<Paginated<Product>>('/products', { token, query: { ...query } }),

  categories: (token: string) => request<string[]>('/products/categories', { token }),

  get: (token: string, id: string) => request<Product>(`/products/${encodeURIComponent(id)}`, { token }),

  findByBarcode: (token: string, barcode: string) =>
    request<Product>(`/products/barcode/${encodeURIComponent(barcode)}`, { token }),

  create: (token: string, input: ProductInput) =>
    request<Product>('/products', { method: 'POST', token, body: input }),

  update: (token: string, id: string, input: Partial<ProductInput>) =>
    request<Product>(`/products/${encodeURIComponent(id)}`, { method: 'PATCH', token, body: input }),

  remove: (token: string, id: string) =>
    request<{ id: string; deleted: boolean }>(`/products/${encodeURIComponent(id)}`, { method: 'DELETE', token }),
};
