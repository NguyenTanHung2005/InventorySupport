import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildDemo,
  checkDemo,
  fixtureRoot,
  type DemoData,
} from './demo-data.js';
describe('mini-mart month', () => {
  it('ships a complete dataset and invoice answers matching the catalog', () => {
    const read = (name: string) =>
      JSON.parse(
        readFileSync(join(fixtureRoot(), name), 'utf8').replace(/^\uFEFF/, ''),
      );
    const data = read('dataset.json') as DemoData;
    expect(checkDemo(data)).toEqual({
      users: 6,
      products: 60,
      transactions: 629,
      notifications: 15,
    });
    expect(read('manifest.json').images).toHaveLength(60);
    for (const number of [1, 2, 3]) {
      const answer = read(`invoices/invoice-${number}.json`) as {
        lines: {
          productId: string;
          barcode: string;
          name: string;
          unit: string;
          quantity: number;
        }[];
      };
      expect(answer.lines).toHaveLength(6);
      for (const line of answer.lines) {
        expect(
          data.products.find((product) => product.id === line.productId),
        ).toMatchObject({
          barcode: line.barcode,
          name: line.name,
          unit: line.unit,
        });
        expect(line.quantity).toBeGreaterThan(0);
      }
    }
  });
  it('produces a consistent month with all products, roles, low and empty stock', () => {
    const demo = buildDemo('2026-11-14');
    expect(demo.products).toHaveLength(60);
    expect(demo.users).toHaveLength(6);
    expect(
      new Set(demo.transactions.map((row) => row.createdAt.slice(0, 10))).size,
    ).toBe(30);
    expect(demo.transactions.length).toBeGreaterThanOrEqual(580);
    expect(demo.products.filter((row) => row.quantity === 0)).toHaveLength(3);
    expect(
      demo.products.filter(
        (row) => row.quantity > 0 && row.quantity <= row.minStock,
      ),
    ).toHaveLength(5);
    expect(checkDemo(demo)).toMatchObject({ products: 60, users: 6 });
  });
  it('rejects broken stock chains and invalid dates', () => {
    expect(() => buildDemo('not-a-date')).toThrow();
    const demo = buildDemo('2026-11-14');
    demo.transactions[0].quantityAfter += 1;
    expect(() => checkDemo(demo)).toThrow();
  });
});
