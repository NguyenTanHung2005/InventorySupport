export type UserRole = 'ADMIN' | 'MANAGER' | 'STAFF' | 'VIEWER';

export type Permission =
  | 'PRODUCT_VIEW'
  | 'PRODUCT_CREATE'
  | 'PRODUCT_UPDATE'
  | 'PRODUCT_DELETE'
  | 'STOCK_IMPORT'
  | 'STOCK_EXPORT'
  | 'STOCK_ADJUST'
  | 'REPORT_VIEW'
  | 'USER_MANAGE'
  | 'AI_USE';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  storeId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
  permissions: Permission[];
}

export interface Product {
  id: string;
  barcode: string;
  name: string;
  normalizedName: string;
  description: string;
  category: string;
  unit: string;
  price: number;
  costPrice: number;
  supplier: string;
  minStock: number;
  imageUrl?: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  barcode?: string;
  name: string;
  description?: string;
  category?: string;
  unit?: string;
  price?: number;
  costPrice?: number;
  supplier?: string;
  minStock?: number;
  imageUrl?: string;
}

export type StockType = 'IMPORT' | 'EXPORT' | 'ADJUSTMENT';

export interface StockTransaction {
  id: string;
  productId: string;
  productName: string;
  type: StockType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  reason?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface InventorySummary {
  productCount: number;
  totalQuantity: number;
  stockValue: number;
  retailValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  importedQuantity: number;
  exportedQuantity: number;
  adjustmentCount: number;
  transactionCount: number;
  exportRevenue: number;
  topExported: { productId: string; productName: string; exported: number }[];
}

export interface AppNotification {
  id: string;
  type: 'LOW_STOCK' | 'OUT_OF_STOCK';
  productId: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AiSuggestion {
  name: string;
  normalizedName: string;
  category: string;
  unit: string;
  description: string;
  confidence: number;
  source: 'heuristic' | 'provider';
  matchedTerms: string[];
  barcode?: string;
  matchedProducts?: Product[];
}

export interface AiResult {
  name: string;
  normalizedName: string;
  category: string;
  unit: string;
  description: string;
  confidence: number;
  source: 'heuristic' | 'provider';
  correctedText: string;
  hasMultipleProductTypes: boolean;
  suggestions: AiSuggestion[];
  imageUrl?: string;
}
