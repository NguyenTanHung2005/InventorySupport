export enum UserRole {
  OWNER = 'OWNER',
  MANAGER = 'MANAGER',
  STAFF = 'STAFF',
  VIEWER = 'VIEWER',
}

export enum StockTransactionType {
  IMPORT = 'IMPORT',
  EXPORT = 'EXPORT',
  ADJUSTMENT = 'ADJUSTMENT',
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  storeId: string;
}

export interface Product {
  id: string;
  storeId: string;
  barcode: string;
  name: string;
  normalizedName: string;
  description: string;
  category: string;
  unit: string;
  price: number;
  minStock: number;
  imageUrl?: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export interface StockTransaction {
  id: string;
  storeId: string;
  productId: string;
  type: StockTransactionType;
  quantity: number;
  reason?: string;
  createdBy: string;
  createdAt: string;
}
