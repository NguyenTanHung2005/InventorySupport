import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GeminiProductVision } from './gemini-product-vision.js';

const item = { name: 'coca', normalizedName: 'Nước Coca', category: 'Nước', unit: 'chai', description: 'Nước giải khát Coca.', barcode: '', confidence: 0.9 };
beforeEach(() => vi.stubEnv('GEMINI_API_KEY', 'mock-key'));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
function respond(value: unknown, finishReason = 'STOP') {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ candidates: [{ finishReason, content: { role: 'model', parts: [{ text: JSON.stringify(value) }] } }] }), { headers: { 'content-type': 'application/json' } })));
}
describe('Gemini extraction', () => {
  it('returns validated product suggestions', async () => {
    respond({ correctedText: 'Coca', hasMoreProducts: false, suggestions: [item] });
    expect((await new GeminiProductVision().normalizeText('coca', [])).suggestions[0].normalizedName).toBe('Nước Coca');
  });
  it('rejects a truncated response', async () => {
    respond({ correctedText: 'Coca', hasMoreProducts: false, suggestions: [item] }, 'MAX_TOKENS');
    await expect(new GeminiProductVision().normalizeText('coca', [])).rejects.toThrow();
  });
  it('rejects an invoice with invalid numeric values rather than turning them into zero', async () => {
    respond({ readable: true, supplier: '', date: '', lines: [{ name: 'Coca', quantity: 'abc', unit: 'chai', unitPrice: 1000, barcode: '', confidence: 0.9 }] });
    await expect(new GeminiProductVision().readDeliveryNote({ base64: 'AA==', mediaType: 'image/png' })).rejects.toMatchObject({ status: 502 });
  });
});
