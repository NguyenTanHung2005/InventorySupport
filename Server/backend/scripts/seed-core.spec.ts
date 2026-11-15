import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { MemoryDatabase } from '../test/helpers/memory-database.js';
import { buildDemo, fixtureRoot } from './demo-data.js';
import { seedDemo, checkImages } from './seed-core.js';
describe('seed safety and bundled images', () => {
  it('has a distinct valid PNG for every catalog item', async () => {
    await expect(
      checkImages(buildDemo('2026-11-14'), join(fixtureRoot(), 'images')),
    ).resolves.toBeUndefined();
  });
  it('refuses to seed occupied collections without changing their data', async () => {
    const db = new MemoryDatabase();
    const destination = await mkdtemp(join(tmpdir(), 'inventory-seed-test-'));
    try {
      await expect(
        seedDemo(
          db,
          buildDemo('2026-11-14'),
          join(fixtureRoot(), 'images'),
          destination,
        ),
      ).rejects.toThrow(/đã có dữ liệu/);
      expect(db.products).toHaveLength(3);
      expect(db.transactions).toHaveLength(0);
    } finally {
      await rm(destination, { recursive: true });
    }
  });
});
