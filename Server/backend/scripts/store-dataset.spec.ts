import { describe, expect, it } from 'vitest';
import { buildStoreDataset, validateStoreDataset } from './store-dataset.js';
import { MemoryDatabase } from '../test/helpers/memory-database.js';
import { UserRole } from '../src/common/types.js';
import { createConnection } from 'mongoose';
import { models } from '../src/database/schemas.js';

describe('two-month replacement dataset', () => {
  it('validates generated documents against the actual Mongo schemas', async () => {
    const connection = createConnection();
    const users = new MemoryDatabase().users;
    const data = buildStoreDataset(
      [
        {
          barcode: 'TEST',
          name: 'Product',
          description: '',
          category: 'Test',
          unit: 'item',
          price: 10000,
          costPrice: 7000,
          supplier: 'Demo',
          minStock: 8,
        },
      ],
      users,
      '2026-11-15',
    );
    for (const table of [
      'products',
      'transactions',
      'notifications',
    ] as const) {
      const schema = models.find((m) => m.name === table)!.schema;
      const model = connection.model(table, schema);
      for (const { id, ...fields } of data[table])
        await expect(
          new model({ _id: id, ...fields }).validate(),
        ).resolves.toBeUndefined();
    }
  });
  const fixture = new MemoryDatabase();
  const catalog = fixture.products.map(
    ({
      barcode,
      name,
      description,
      category,
      unit,
      price,
      costPrice,
      supplier,
      minStock,
    }) => ({
      barcode,
      name,
      description,
      category,
      unit,
      price,
      costPrice,
      supplier,
      minStock,
    }),
  );
  it('is deterministic, spans 60 local days, and replays to final stock', () => {
    const data = buildStoreDataset(catalog, fixture.users, '2026-11-15');
    expect(data).toEqual(
      buildStoreDataset(catalog, fixture.users, '2026-11-15'),
    );
    expect(data.startDay).toBe('2026-09-17');
    expect(data.endDay).toBe('2026-11-15');
    expect(data.transactions.length).toBeGreaterThan(1200);
    expect(
      new Set(
        data.transactions.map((t) =>
          new Date(Date.parse(t.createdAt) + 7 * 3600000)
            .toISOString()
            .slice(0, 10),
        ),
      ).size,
    ).toBe(60);
    expect(() => validateStoreDataset(data, fixture.users)).not.toThrow();
    expect(data.notifications.some((n) => n.type === 'OUT_OF_STOCK')).toBe(
      true,
    );
    expect(data.products.some((p) => p.quantity === 0)).toBe(true);
    expect(
      data.products.some((p) => p.quantity > 0 && p.quantity <= p.minStock),
    ).toBe(true);
    expect(
      data.products.every(
        (p) =>
          p.stockVersion ===
          data.transactions.filter((t) => t.productId === p.id).length,
      ),
    ).toBe(true);
  });
  it('does not alter accounts and rejects stores without a permitted actor', () => {
    const users = structuredClone(fixture.users),
      before = structuredClone(users);
    buildStoreDataset(catalog, users, '2026-11-15');
    expect(users).toEqual(before);
    expect(() =>
      buildStoreDataset(
        catalog,
        [{ ...users[0], role: UserRole.VIEWER }],
        '2026-11-15',
      ),
    ).toThrow();
    expect(() =>
      buildStoreDataset(
        catalog,
        [...users, { ...users[0], storeId: 'other' }],
        '2026-11-15',
      ),
    ).toThrow();
  });
  it('rejects corrupted quantity chains and foreign references', () => {
    const data = buildStoreDataset(catalog, fixture.users, '2026-11-15');
    data.transactions[0].quantityAfter++;
    expect(() => validateStoreDataset(data, fixture.users)).toThrow();
    const another = buildStoreDataset(catalog, fixture.users, '2026-11-15');
    another.notifications[0].productId = 'missing';
    expect(() => validateStoreDataset(another, fixture.users)).toThrow();
  });
});
