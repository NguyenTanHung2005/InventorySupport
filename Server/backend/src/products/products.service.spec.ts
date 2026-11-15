import { describe, expect, it } from 'vitest';
import { DatabaseService } from '../database/database.service.js';
import { UserRole } from '../common/types.js';
import { ProductsService } from './products.service.js';

const user = { id: 'user', name: 'User', email: '', storeId: 'store-1', role: UserRole.MANAGER };
describe('product suggestion matching', () => {
  it('recognizes an existing full name inside a descriptive AI title', () => {
    const service = new ProductsService(new DatabaseService());
    expect(service.match(user, { name: 'Nước ngọt Coca-Cola chai 390ml' }).map(p => p.id)).toEqual(['product-1']);
    expect(service.match(user, { name: 'Nước ngọt Coca-Cola chai 1,5 lít' })).toEqual([]);
  });
  it('does not match a different explicit pack size on a shared brand name', () => {
    const service = new ProductsService(new DatabaseService());
    expect(service.match(user, { name: 'Coca-Cola 1,5L' })).toEqual([]);
    expect(service.match(user, { name: 'Coca-Cola 390ml' }).map(p => p.id)).toEqual(['product-1']);
    expect(service.match({ ...user, storeId: 'other' }, { name: 'Coca-Cola 390ml' })).toEqual([]);
  });
});
