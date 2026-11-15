import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { randomUUID } from 'node:crypto';
import type { Connection } from 'mongoose';
import { DatabaseService } from '../src/database/database.service.js';
import { MemoryDatabase } from './helpers/memory-database.js';
import { InventoryService } from '../src/inventory/inventory.service.js';
import { UsersService } from '../src/users/users.service.js';
import { ProductsService } from '../src/products/products.service.js';
import { NotificationsService } from '../src/notifications/notifications.service.js';
import { UserRole, StockTransactionType } from '../src/common/types.js';

// Opt-in only: a real replica set. This suite never claims the RAM fixture verifies Mongo isolation.
describe.skipIf(!process.env.MONGODB_TEST_URI)(
  'Mongo replica-set integration',
  () => {
    let connection: Connection,
      db: DatabaseService,
      inventory: InventoryService;
    const databaseName = `inventory_support_test_${randomUUID().replaceAll('-', '')}`;
    const fixture = new MemoryDatabase(),
      manager = fixture.users[1];
    beforeAll(async () => {
      const { createConnection } = await import('mongoose');
      const { models } = await import('../src/database/schemas.js');
      connection = await createConnection(process.env.MONGODB_TEST_URI!, {
        dbName: databaseName,
        serverSelectionTimeoutMS: 10000,
      }).asPromise();
      for (const { name, schema, collection } of models)
        await connection.model(name, schema, collection).init();
      db = new DatabaseService(connection);
      inventory = new InventoryService(
        db,
        new ProductsService(db),
        new NotificationsService(db),
      );
    });
    beforeEach(async () => {
      for (const name of ['users', 'products', 'transactions', 'notifications'])
        await connection.model(name).deleteMany({});
      for (const user of fixture.users) await db.insert('users', user);
      for (const product of fixture.products)
        await db.insert('products', product);
    });
    afterAll(async () => {
      vi.restoreAllMocks();
      if (connection) {
        if (
          connection.name === databaseName &&
          databaseName.startsWith('inventory_support_test_')
        )
          await connection.dropDatabase();
        await connection.close();
      }
    });
    it('allows only one of two concurrent exports that together exceed stock', async () => {
      const results = await Promise.allSettled(
        [1, 2].map(() =>
          inventory.move(
            {
              productId: 'product-1',
              type: StockTransactionType.EXPORT,
              quantity: 20,
            },
            manager,
          ),
        ),
      );
      expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(
        1,
      );
      expect((await db.get('products', { _id: 'product-1' }))?.quantity).toBe(
        4,
      );
      expect(await db.find('transactions')).toHaveLength(1);
    });
    it('rolls the product back when a history insert fails', async () => {
      const original = DatabaseService.prototype.insert;
      const spy = vi
        .spyOn(DatabaseService.prototype, 'insert')
        .mockImplementation(async function (this: DatabaseService, table, row) {
          if (table === 'transactions')
            throw new Error('injected history failure');
          return original.bind(this)<
            'users' | 'products' | 'transactions' | 'notifications'
          >(table, row);
        });
      try {
        await expect(
          inventory.move(
            {
              productId: 'product-1',
              type: StockTransactionType.EXPORT,
              quantity: 24,
            },
            manager,
          ),
        ).rejects.toThrow('injected history failure');
        expect((await db.get('products', { _id: 'product-1' }))?.quantity).toBe(
          24,
        );
        expect(await db.find('transactions')).toHaveLength(0);
        expect(await db.find('notifications')).toHaveLength(0);
      } finally {
        spy.mockRestore();
      }
    });
    it('enforces the unique barcode index even for simultaneous creates', async () => {
      const products = new ProductsService(db);
      const results = await Promise.allSettled(
        [1, 2].map(() =>
          products.create({ name: 'Mẫu', barcode: 'DEMO-UNIQUE' }, manager),
        ),
      );
      expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(
        1,
      );
    });
    it('preserves a serial stock chain for concurrent adjustments', async () => {
      await Promise.all(
        [7, 9].map((quantity) =>
          inventory.move(
            {
              productId: 'product-1',
              type: StockTransactionType.ADJUSTMENT,
              quantity,
              reason: 'Concurrent count',
            },
            manager,
          ),
        ),
      );
      const rows = await db.find('transactions', { productId: 'product-1' });
      expect(rows).toHaveLength(2);
      const first = rows.find((row) => row.quantityBefore === 24)!;
      const last = rows.find((row) => row.id !== first.id)!;
      expect(last.quantityBefore).toBe(first.quantityAfter);
      expect((await db.get('products', { _id: 'product-1' }))?.quantity).toBe(
        last.quantityAfter,
      );
    });
    it('enforces unique emails under simultaneous creates', async () => {
      const users = new UsersService(db);
      const results = await Promise.allSettled(
        [1, 2].map(() =>
          users.create(fixture.users[0], {
            name: 'New staff',
            email: 'same@example.com',
            password: 'demo123',
            role: UserRole.STAFF,
          }),
        ),
      );
      expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(
        1,
      );
    });
    it('keeps an active administrator during competing demotion and deletion', async () => {
      const first = fixture.users[0];
      const second = {
        ...first,
        id: 'user-admin-2',
        email: 'admin2@example.com',
      };
      await db.insert('users', second);
      const users = new UsersService(db);
      const results = await Promise.allSettled([
        users.update(first, second.id, { role: UserRole.STAFF }),
        users.remove(second, first.id),
      ]);
      expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(
        1,
      );
      expect(
        await db.find('users', { role: UserRole.ADMIN, active: true }),
      ).toHaveLength(1);
    });
    it('allows at most one owner for a newly registered push token', async () => {
      const notifications = new NotificationsService(db);
      const token = 'ExponentPushToken[concurrent]';
      await Promise.allSettled(
        [fixture.users[0], fixture.users[1]].map((user) =>
          notifications.registerPushToken(user, token),
        ),
      );
      expect(await db.find('users', { pushTokens: token })).toHaveLength(1);
      await notifications.registerPushToken(fixture.users[1], token);
      expect(
        (await db.find('users', { pushTokens: token })).map((user) => user.id),
      ).toEqual([fixture.users[1].id]);
    });
  },
);
