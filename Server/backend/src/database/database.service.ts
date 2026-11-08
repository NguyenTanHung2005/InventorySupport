import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Product,
  StockTransaction,
  UserRole,
} from '../common/types.js';

interface StoredUser {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  storeId: string;
}

@Injectable()
export class DatabaseService {
  readonly users: StoredUser[] = [
    {
      id: 'user-owner-1',
      name: 'Chủ cửa hàng',
      email: 'owner@example.com',
      passwordHash: '2a97516c354b68848cdbd8f54a226a0a55b21ed138e207ad6c5cbb9c00aa5aea',
      role: UserRole.OWNER,
      storeId: 'store-1',
    },
  ];

  readonly products: Product[] = [
    {
      id: 'product-1',
      storeId: 'store-1',
      barcode: '8934588012345',
      name: 'Coca-Cola 390ml',
      normalizedName: 'Coca-Cola',
      description: 'Nước ngọt có ga chai 390ml',
      category: 'Nước giải khát',
      unit: 'chai',
      price: 10000,
      minStock: 10,
      quantity: 24,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  readonly transactions: StockTransaction[] = [];

  createId(prefix: string): string {
    return `${prefix}-${randomUUID()}`;
  }
}
