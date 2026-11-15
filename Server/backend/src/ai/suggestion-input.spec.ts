import { describe, expect, it, vi } from 'vitest';
vi.mock('../../../../App/InventorySupport/src/constants/config', () => ({ API_URL: 'http://test' }));
const servicePath = new URL('../../../../App/InventorySupport/src/services/ai.service.ts', import.meta.url).href;
const { aiService } = await import(servicePath);

describe('app suggestion mapping', () => {
  it('requires deliberate invoice selection for multiple candidates or mismatched units', () => {
    const p = { id: 'one', name: 'Coca-Cola', unit: 'chai' };
    expect(aiService.invoiceCandidate({ unit: 'chai', candidates: [p] })).toEqual(p);
    expect(aiService.invoiceCandidate({ unit: 'chai', candidates: [p, { ...p, id: 'two' }] })).toBeUndefined();
    expect(aiService.invoiceCandidate({ unit: 'thùng', candidates: [p] })).toBeUndefined();
    expect(aiService.invoiceCandidate({ unit: 'chai', candidates: [] })).toBeUndefined();
  });
  it('uses the selected title and separate description without inventing stock or prices', () => {
    const result = aiService.productInput({ name: 'coca', normalizedName: 'Nước ngọt Coca-Cola chai 390ml', description: 'Nước ngọt đóng chai dung tích 390ml.', category: 'Nước giải khát', unit: 'chai', barcode: undefined });
    expect(result).toEqual({ name: 'Nước ngọt Coca-Cola chai 390ml', description: 'Nước ngọt đóng chai dung tích 390ml.', category: 'Nước giải khát', unit: 'chai', barcode: undefined });
    expect(result).not.toHaveProperty('price');
    expect(result).not.toHaveProperty('quantity');
  });
});
