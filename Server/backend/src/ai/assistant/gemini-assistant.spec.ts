import { afterEach, describe, expect, it, vi } from 'vitest';
import { UserRole } from '../../common/types.js';
import { MemoryDatabase } from '../../../test/helpers/memory-database.js';
import { InventoryService } from '../../inventory/inventory.service.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import { ProductsService } from '../../products/products.service.js';
import { AssistantSessionStore } from './assistant-session.store.js';
import { AssistantService } from './assistant.service.js';

afterEach(() => vi.unstubAllEnvs());
describe('Gemini assistant', () => {
  it('executes permitted tools and proposes a stock movement without saving it', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    const database = new MemoryDatabase();
    const products = new ProductsService(database);
    const inventory = new InventoryService(database, products, new NotificationsService(database));
    const service = new AssistantService(new AssistantSessionStore(), products, inventory);
    const generateContent = vi.fn()
      .mockResolvedValueOnce({ candidates: [{ finishReason: 'STOP', content: { parts: [{ functionCall: { name: 'propose_stock_movement', args: { product_id: 'product-1', type: 'EXPORT', quantity: 2 } } }] } }] })
      .mockResolvedValueOnce({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Hãy xác nhận.' }] } }] });
    (service as unknown as { client: unknown }).client = { models: { generateContent } };
    const reply = await service.chat({ id: 'manager', name: 'Manager', email: 'm@example.com', role: UserRole.MANAGER, storeId: 'store-1' }, { message: 'Xuất 2 Coca' });
    expect(reply.provider).toBe('gemini');
    expect(reply.actions[0]).toMatchObject({ kind: 'STOCK_MOVEMENT', quantity: 2 });
    expect(database.products.find(product => product.id === 'product-1')?.quantity).toBe(24);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });
});
