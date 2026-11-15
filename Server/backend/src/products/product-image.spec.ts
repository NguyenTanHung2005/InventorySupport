import { describe, expect, it } from 'vitest';
import { MemoryDatabase } from '../../test/helpers/memory-database.js';
import { ProductsService } from './products.service.js';
describe('product image removal', () => {
  it('unsets the stored image when the form sends an empty URL', async () => {
    const db = new MemoryDatabase();
    db.products[0].imageUrl = '/uploads/store-1/old.png';
    const product = await new ProductsService(db).update(
      'product-1',
      { imageUrl: '' },
      db.users[1],
    );
    expect(product.imageUrl).toBeUndefined();
    expect(db.products[0].imageUrl).toBeUndefined();
  });
});
