import { Paginated, Product, ProductInput, ProductLabel, ScanResolveResult } from '../types';
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

  /** Gửi nguyên chuỗi camera đọc được; backend tự nhận dạng mã vạch / tem QR / GS1. */
  resolve: (token: string, raw: string) => request<ScanResolveResult>('/products/resolve', { token, query: { raw } }),

  label: (token: string, id: string) => request<ProductLabel>(`/products/${encodeURIComponent(id)}/label`, { token }),

  create: (token: string, input: ProductInput) =>
    request<Product>('/products', { method: 'POST', token, body: input }),

  update: (token: string, id: string, input: Partial<ProductInput>) =>
    request<Product>(`/products/${encodeURIComponent(id)}`, { method: 'PATCH', token, body: input }),

  remove: (token: string, id: string) =>
    request<{ id: string; deleted: boolean }>(`/products/${encodeURIComponent(id)}`, { method: 'DELETE', token }),
};
