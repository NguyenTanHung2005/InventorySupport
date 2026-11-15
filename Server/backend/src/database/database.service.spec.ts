import { describe, expect, it } from 'vitest';
import { DatabaseService, mongoUri, fromDocument } from './database.service.js';
describe('Mongo boundary', () => {
  it('fails startup when a required index cannot be initialized', async () => {
    const connection = {
      model: () => ({
        init: async () => {
          throw new Error('index failed');
        },
      }),
    };
    const db = new DatabaseService(
      connection as unknown as ConstructorParameters<typeof DatabaseService>[0],
    );
    await expect(db.onModuleInit()).rejects.toThrow('index failed');
  });
  it('requires an explicit URI rather than demo JSON', () => {
    expect(() => mongoUri(undefined)).toThrow(/MONGODB_URI/);
    expect(() => mongoUri('data/db.json')).toThrow(/MONGODB_URI/);
    expect(mongoUri('mongodb://localhost:27017/test')).toBe(
      'mongodb://localhost:27017/test',
    );
  });
  it('maps IDs and preserves timestamps', () => {
    expect(
      fromDocument({
        _id: 'product-1',
        __v: 2,
        createdAt: '2026-11-01T00:00:00.000Z',
      }),
    ).toEqual({ id: 'product-1', createdAt: '2026-11-01T00:00:00.000Z' });
  });
});
