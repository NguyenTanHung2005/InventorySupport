import { API_URL } from '../constants/config';
import { AuthResponse, Product } from '../types';

export async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  if (!response.ok) throw new Error((await response.text()) || `Request failed with status ${response.status}`);
  return response.json() as Promise<T>;
}

export function login(email: string, password: string) {
  return request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function register(name: string, email: string, password: string) {
  return request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, role: 'STAFF' }) });
}

export function getProducts(token: string) { return request<Product[]>('/products', {}, token); }
export function getLowStock(token: string) { return request<Product[]>('/inventory/low-stock', {}, token); }
export function getProductByBarcode(token: string, barcode: string) { return request<Product>(`/products/barcode/${encodeURIComponent(barcode)}`, {}, token); }
export function moveStock(token: string, productId: string, type: 'IMPORT' | 'EXPORT', quantity: number, reason: string) {
  return request<Product>('/inventory/movement', { method: 'POST', body: JSON.stringify({ productId, type, quantity, reason }) }, token);
}
export function normalizeProduct(token: string, text: string) {
  return request<{
    name: string;
    normalizedName: string;
    category: string;
    unit: string;
    description: string;
    confidence: number;
    correctedText: string;
    hasMultipleProductTypes: boolean;
    suggestions: Array<{
      name: string;
      normalizedName: string;
      category: string;
      unit: string;
      description: string;
      confidence: number;
      matchedTerms: string[];
    }>;
  }>('/ai/normalize-product', { method: 'POST', body: JSON.stringify({ text }) }, token);
}

export function createProduct(token: string, product: { barcode: string; name: string; description: string; category: string; unit: string; price?: number; minStock?: number }) {
  return request<Product>('/products', { method: 'POST', body: JSON.stringify(product) }, token);
}
