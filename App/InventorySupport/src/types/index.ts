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

/* --------------------------------- Quét (docs/SCAN.md) --------------------------------- */

export type ScanFormat = 'APP_QR' | 'GS1_DIGITAL_LINK' | 'BARCODE' | 'TEXT';

export interface ScanResolveResult {
  raw: string;
  code: string;
  format: ScanFormat;
  product: Product | null;
}

export interface ProductLabel {
  productId: string;
  name: string;
  barcode: string;
  price: number;
  unit: string;
  payload: string;
  qrDataUrl: string;
}

export interface StockBatchResult {
  count: number;
  transactions: StockTransaction[];
  products: Product[];
  alerts: AppNotification[];
}

export interface InvoiceLine {
  index: number;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  barcode: string;
  confidence: number;
  candidates: Product[];
}

export interface InvoiceScanResult {
  readable: boolean;
  supplier: string;
  date: string;
  imageUrl?: string;
  lines: InvoiceLine[];
}

/* --------------------------- Trợ lý hỏi đáp (docs/AI_ASSISTANT.md) --------------------------- */

export interface AssistantProduct {
  id: string;
  name: string;
  barcode: string;
  category: string;
  unit: string;
  quantity: number;
  minStock: number;
  price: number;
  costPrice?: number;
  imageUrl?: string;
  status: 'OK' | 'LOW' | 'OUT';
}

export type AssistantAction =
  | {
      id: string;
      kind: 'STOCK_MOVEMENT';
      productId: string;
      productName: string;
      unit: string;
      type: StockType;
      quantity: number;
      reason?: string;
      currentQuantity: number;
    }
  | {
      id: string;
      kind: 'CREATE_PRODUCT';
      prefill: Partial<ProductInput> & { name: string };
    };

export interface AssistantReply {
  sessionId: string;
  provider: 'claude' | 'offline';
  reply: string;
  products: AssistantProduct[];
  actions: AssistantAction[];
  toolCalls: { name: string; summary: string }[];
  turn: number;
  maxTurns: number;
}

export interface AiStatus {
  provider: 'claude' | 'heuristic';
  assistant: { provider: 'claude' | 'offline'; model?: string; maxTurns: number };
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
