import { describe, expect, it, vi } from 'vitest';
import type { Connection } from 'mongoose';
import {
  applyStoreReplacement,
  businessTables,
  digest,
  replacementFailureMessage,
} from './replace-store-core.js';
import { buildStoreDataset } from './store-dataset.js';
import { MemoryDatabase } from '../test/helpers/memory-database.js';

describe('replacement safety gates', () => {
  it('clearly identifies report failures after a successful commit', () => {
    expect(replacementFailureMessage(true, 'backup.json')).toContain(
      'COMMITTED',
    );
    expect(replacementFailureMessage(true, 'backup.json')).toContain(
      'backup.json',
    );
    expect(replacementFailureMessage(false, 'backup.json')).toContain(
      'not confirmed',
    );
  });
  it('uses canonical digests without exposing credentials', () => {
    expect(digest({ b: 2, a: 1 })).toBe(digest({ a: 1, b: 2 }));
    expect(digest({ passwordHash: 'secret' })).not.toContain('secret');
  });
  it('never targets the users collection for replacement', () => {
    expect(businessTables).toEqual([
      'products',
      'transactions',
      'notifications',
      'stocktake_sessions',
      'stocktake_items',
    ]);
  });
  it('rejects an incomplete dataset before any database operation', async () => {
    const fixture = new MemoryDatabase();
    const data = buildStoreDataset(
      fixture.products,
      fixture.users,
      '2026-11-15',
    );
    const transaction = vi.fn();
    await expect(
      applyStoreReplacement(
        { transaction } as unknown as Connection,
        data,
        {} as never,
        [],
      ),
    ).rejects.toThrow('65');
    expect(transaction).not.toHaveBeenCalled();
  });
});
