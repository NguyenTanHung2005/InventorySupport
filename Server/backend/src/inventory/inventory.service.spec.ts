import { describe, expect, it, vi } from 'vitest';
import { MemoryDatabase } from '../../test/helpers/memory-database.js';
import { ProductsService } from '../products/products.service.js';
import { InventoryService } from './inventory.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { StockTransactionType, UserRole } from '../common/types.js';
const manager = {
  id: 'user-manager-1',
  name: 'Quản lý',
  email: 'manager@example.com',
  role: UserRole.MANAGER,
  storeId: 'store-1',
};
function setup() {
  const db = new MemoryDatabase();
  const products = new ProductsService(db),
    notifications = new NotificationsService(db);
  return {
    db,
    products,
    notifications,
    inventory: new InventoryService(db, products, notifications),
  };
}
describe('async inventory writes', () => {
  it('does not overwrite stock when a product edit races with a stock movement', async () => {
    const { db, products } = setup();
    const update = db.update.bind(db);
    vi.spyOn(db, 'update').mockImplementation(async (table, filter, fields) => {
      db.products[0].quantity = 31;
      return update(table, filter, fields);
    });
    await products.update('product-1', { name: 'Tên mới' }, manager);
    expect(db.products[0].quantity).toBe(31);
  });
  it('rolls stock and alerts back if writing history fails', async () => {
    const { db, inventory, notifications } = setup();
    const insert = db.insert.bind(db);
    vi.spyOn(db, 'insert').mockImplementation(async (table, value) => {
      if (table === 'transactions') throw new Error('write failed');
      return insert<'users' | 'products' | 'transactions' | 'notifications'>(
        table,
        value,
      );
    });
    const push = vi.spyOn(notifications, 'sendPush');
    await expect(
      inventory.move(
        {
          productId: 'product-1',
          type: StockTransactionType.EXPORT,
          quantity: 24,
        },
        manager,
      ),
    ).rejects.toThrow('write failed');
    expect(db.products[0].quantity).toBe(24);
    expect(db.transactions).toHaveLength(0);
    expect(db.notifications).toHaveLength(0);
    expect(push).not.toHaveBeenCalled();
  });
  it('rejects an invalid batch without applying the valid first line', async () => {
    const { db, inventory } = setup();
    await expect(
      inventory.moveBatch(
        {
          type: StockTransactionType.EXPORT,
          items: [
            { productId: 'product-1', quantity: 2 },
            { productId: 'product-2', quantity: 999 },
          ],
        },
        manager,
      ),
    ).rejects.toThrow(/Dòng 2/);
    expect(db.products[0].quantity).toBe(24);
    expect(db.transactions).toHaveLength(0);
  });
  it('adjusts to zero and persists before dispatching push', async () => {
    const { db, inventory, notifications } = setup();
    const push = vi
      .spyOn(notifications, 'sendPush')
      .mockImplementation(async () => {
        expect(db.products[0].quantity).toBe(0);
        expect(db.transactions).toHaveLength(1);
        expect(db.notifications).toHaveLength(1);
      });
    const result = await inventory.move(
      {
        productId: 'product-1',
        type: StockTransactionType.ADJUSTMENT,
        quantity: 0,
        reason: 'Kiểm đếm',
      },
      manager,
    );
    expect(result.transaction).toMatchObject({
      quantity: -24,
      quantityBefore: 24,
      quantityAfter: 0,
    });
    expect(push).toHaveBeenCalledOnce();
  });
});
