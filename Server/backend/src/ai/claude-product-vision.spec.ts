import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ClaudeProductVision } from './claude-product-vision.js';

const item = { name: 'coca chai 390ml', normalizedName: 'Nước ngọt Coca-Cola chai 390ml', category: 'Nước giải khát', unit: 'chai', description: 'Nước ngọt Coca-Cola, đóng chai dung tích 390ml.', barcode: '', confidence: 0.9 };
const output = () => ({ correctedText: 'Coca chai 390ml', hasMoreProducts: false, suggestions: [{ ...item }] });

function respond(value: unknown, stop = 'end_turn') {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    id: 'msg-test', type: 'message', role: 'assistant', model: 'test-model', stop_reason: stop,
    content: [{ type: 'text', text: JSON.stringify(value) }], usage: { input_tokens: 10, output_tokens: 20 },
  }), { headers: { 'content-type': 'application/json' } })));
}

beforeEach(() => vi.stubEnv('ANTHROPIC_API_KEY', 'test-key'));
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('Claude product extraction boundary', () => {
  it('preserves independent titles and descriptions through the SDK parser', async () => {
    const value = output();
    value.suggestions.push({ ...item, name: 'oreo 133g', normalizedName: 'Bánh Oreo 133g', category: 'Bánh', unit: 'gói', description: 'Bánh Oreo đóng gói khối lượng 133g.' });
    respond(value);
    const result = await new ClaudeProductVision().normalizeText('coca chai 390ml; oreo 133g', []);
    expect(result.suggestions.map(i => [i.normalizedName, i.description])).toEqual([
      ['Nước ngọt Coca-Cola chai 390ml', 'Nước ngọt Coca-Cola, đóng chai dung tích 390ml.'],
      ['Bánh Oreo 133g', 'Bánh Oreo đóng gói khối lượng 133g.'],
    ]);
  });

  it.each([
    { ...item, normalizedName: '' }, { ...item, normalizedName: 'a'.repeat(201) },
    { ...item, category: 'a'.repeat(81) }, { ...item, unit: 'a'.repeat(31) },
    { ...item, description: '' }, { ...item, description: item.normalizedName },
    { ...item, description: 'a'.repeat(2001) }, { ...item, confidence: null },
    { ...item, confidence: 1.5 }, { ...item, name: 123 },
  ])('rejects invalid product fields %#', async (invalid) => {
    respond({ ...output(), suggestions: [invalid] });
    await expect(new ClaudeProductVision().normalizeText('coca', [])).rejects.toThrow();
  });

  it.each(['refusal', 'max_tokens'])('rejects %s even with parseable output', async (stop) => {
    respond(output(), stop);
    await expect(new ClaudeProductVision().normalizeText('coca', [])).rejects.toThrow();
  });

  it.each([
    { ...output(), hasMoreProducts: true },
    { ...output(), suggestions: Array.from({ length: 6 }, () => ({ ...item })) },
  ])('does not silently drop products beyond the limit %#', async (value) => {
    respond(value);
    await expect(new ClaudeProductVision().normalizeText('nhiều món', [])).rejects.toThrow(/5 sản phẩm/);
  });

  it('accepts no recognized product as an empty result', async () => {
    respond({ ...output(), suggestions: [] });
    expect((await new ClaudeProductVision().normalizeText('xin chào', [])).suggestions).toEqual([]);
  });
});
