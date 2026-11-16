import { StocktakesService } from '../src/stocktakes/stocktakes.service.js';
import { buildStoreDataset } from '../scripts/store-dataset.js';
import {
  applyStoreReplacement,
  digest,
  readBusinessSnapshot,
  readUsers,
} from '../scripts/replace-store-core.js';
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
      for (const name of [
        'users',
        'products',
        'transactions',
        'notifications',
        'stocktake_sessions',
        'stocktake_items',
      ])
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
    it('replaces business data atomically while preserving every account field', async () => {
      const stocktakes = new StocktakesService(
        db,
        new NotificationsService(db),
      );
      const open = await stocktakes.create(manager);
      const found = await stocktakes.identify(
        open.id,
        { productId: 'product-1' },
        manager,
      );
      await stocktakes.save(
        open.id,
        'product-1',
        {
          countedQuantity: 24,
          baselineStockVersion: found.baselineStockVersion,
          expectedUnit: found.product.unit,
          expectedRevision: 0,
        },
        manager,
      );
      const usersBefore = await readUsers(connection);
      const backup = await readBusinessSnapshot(connection, 'store-1');
      const catalog = Array.from({ length: 65 }, (_, i) => ({
        ...fixture.products[i % 3],
        barcode: 'RETAIL-' + i,
        name: 'Retail ' + i,
      }));
      const data = buildStoreDataset(catalog, fixture.users, '2026-11-15');
      await applyStoreReplacement(connection, data, backup, usersBefore);
      expect(await connection.model('products').countDocuments()).toBe(65);
      expect(await connection.model('transactions').countDocuments()).toBe(
        data.transactions.length,
      );
      expect(digest(await readUsers(connection))).toBe(digest(usersBefore));
      expect(await db.get('products', { _id: 'product-1' })).toBeUndefined();
      expect(
        await connection.model('stocktake_sessions').countDocuments(),
      ).toBe(0);
      expect(await connection.model('stocktake_items').countDocuments()).toBe(
        0,
      );
    });
    it('aborts replacement when business data changed after backup', async () => {
      const usersBefore = await readUsers(connection),
        backup = await readBusinessSnapshot(connection, 'store-1');
      const data = buildStoreDataset(
        Array.from({ length: 65 }, (_, i) => ({
          ...fixture.products[i % 3],
          barcode: 'RETAIL-' + i,
          name: 'Retail ' + i,
        })),
        fixture.users,
        '2026-11-15',
      );
      await db.update(
        'products',
        { _id: 'product-1' },
        { $set: { quantity: 99 } },
      );
      await expect(
        applyStoreReplacement(connection, data, backup, usersBefore),
      ).rejects.toThrow('changed after backup');
      expect((await db.get('products', { _id: 'product-1' }))?.quantity).toBe(
        99,
      );
      expect(await connection.model('products').countDocuments()).toBe(3);
    });
    it('rolls back old business rows when a new insert fails after deletion', async () => {
      const usersBefore = await readUsers(connection),
        backup = await readBusinessSnapshot(connection, 'store-1');
      const data = buildStoreDataset(
        Array.from({ length: 65 }, (_, i) => ({
          ...fixture.products[i % 3],
          barcode: 'RETAIL-' + i,
          name: 'Retail ' + i,
        })),
        fixture.users,
        '2026-11-15',
      );
      const insert = vi
        .spyOn(connection.model('transactions'), 'insertMany')
        .mockRejectedValueOnce(new Error('Injected insertion failure'));
      await expect(
        applyStoreReplacement(connection, data, backup, usersBefore),
      ).rejects.toThrow('Injected insertion failure');
      insert.mockRestore();
      expect(digest(await readBusinessSnapshot(connection, 'store-1'))).toBe(
        digest(backup),
      );
      expect(digest(await readUsers(connection))).toBe(digest(usersBefore));
    });
    it('aborts before deletion when an account changed after preview', async () => {
      const usersBefore = await readUsers(connection),
        backup = await readBusinessSnapshot(connection, 'store-1');
      const data = buildStoreDataset(
        Array.from({ length: 65 }, (_, i) => ({
          ...fixture.products[i % 3],
          barcode: 'RETAIL-' + i,
          name: 'Retail ' + i,
        })),
        fixture.users,
        '2026-11-15',
      );
      await db.update(
        'users',
        { _id: manager.id },
        { $set: { name: 'Changed name' } },
      );
      await expect(
        applyStoreReplacement(connection, data, backup, usersBefore),
      ).rejects.toThrow('Accounts changed');
      expect(digest(await readBusinessSnapshot(connection, 'store-1'))).toBe(
        digest(backup),
      );
    });
    async function counted(quantity = 24) {
      const service = new StocktakesService(db, new NotificationsService(db));
      const session = await service.create(manager);
      const found = await service.identify(
        session.id,
        { productId: 'product-1' },
        manager,
      );
      await service.save(
        session.id,
        'product-1',
        {
          countedQuantity: quantity,
          baselineStockVersion: found.baselineStockVersion,
          expectedRevision: 0,
          expectedUnit: found.product.unit,
        },
        manager,
      );
      return { service, session: await service.detail(session.id, manager) };
    }
    it('completes concurrent retries once, without duplicate movements', async () => {
      const { service, session } = await counted(20);
      const results = await Promise.all([
        service.complete(
          session.id,
          { reason: 'count', expectedRevision: session.revision },
          manager,
        ),
        service.complete(
          session.id,
          { reason: 'count', expectedRevision: session.revision },
          manager,
        ),
      ]);
      expect(results[0]).toEqual(results[1]);
      expect(
        await db.find('transactions', { stocktakeSessionId: session.id }),
      ).toHaveLength(1);
    });
    it('serializes save against completion', async () => {
      const { service, session } = await counted(20);
      const results = await Promise.allSettled([
        service.complete(
          session.id,
          { reason: 'count', expectedRevision: session.revision },
          manager,
        ),
        service.save(
          session.id,
          'product-1',
          {
            countedQuantity: 10,
            baselineStockVersion: 0,
            expectedUnit: 'chai',
            expectedRevision: 1,
          },
          manager,
        ),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const detail = await service.detail(session.id, manager);
      expect(
        detail.status === 'COMPLETED'
          ? detail.items[0].countedQuantity === 20
          : detail.items[0].countedQuantity === 10,
      ).toBe(true);
    });
    it('serializes cancel against completion', async () => {
      const { service, session } = await counted(20);
      const results = await Promise.allSettled([
        service.complete(
          session.id,
          { reason: 'count', expectedRevision: session.revision },
          manager,
        ),
        service.cancel(
          session.id,
          { expectedRevision: session.revision },
          manager,
        ),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const detail = await service.detail(session.id, manager);
      expect((await db.get('products', { _id: 'product-1' }))?.quantity).toBe(
        detail.status === 'COMPLETED' ? 20 : 24,
      );
    });
    it('protects matching lines against a concurrent export', async () => {
      const { service, session } = await counted();
      const results = await Promise.allSettled([
        service.complete(
          session.id,
          { reason: 'count', expectedRevision: session.revision },
          manager,
        ),
        inventory.move(
          {
            productId: 'product-1',
            type: StockTransactionType.EXPORT,
            quantity: 1,
          },
          manager,
        ),
      ]);
      expect(results[1].status).toBe('fulfilled');
      expect((await db.get('products', { _id: 'product-1' }))?.quantity).toBe(
        23,
      );
      if (results[0].status === 'rejected')
        expect((await service.detail(session.id, manager)).status).toBe(
          'IN_PROGRESS',
        );
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
