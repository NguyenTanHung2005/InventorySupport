import { AiService } from './ai.service.js';
import { afterEach, vi } from 'vitest';
import { GeminiProductVision } from './gemini-product-vision.js';

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('AiService', () => {
  it('splits different product nouns and corrects Vietnamese spelling', () => {
    const result = new AiService().normalizeProduct({
      text: 'nuoc ngot, da vien',
    });

    expect(result.correctedText).toBe('nước ngọt, đá viên');
    expect(result.suggestions).toHaveLength(2);
    expect(result.suggestions.map((item) => item.category)).toEqual([
      'Nước giải khát',
      'Đá lạnh',
    ]);
    expect(result.hasMultipleProductTypes).toBe(true);
  });

  it('labels offline results when the provider is not configured', async () => {
    vi.spyOn(GeminiProductVision, 'isConfigured').mockReturnValue(false);
    await expect(new AiService().normalize({ text: 'coca' }, [])).rejects.toMatchObject({ status: 503 });
  });

  it('keeps newlines as separators and decimal commas inside a product', () => {
    const result = new AiService().normalizeProduct({ text: 'sua 1,5 lit\nbanh oreo' });
    expect(result.suggestions.map(i => i.name)).toEqual(['sữa 1,5 lit', 'bánh oreo']);
  });

  it.each([123, {}, [], null])('rejects non-string input as a bad request %#', async (text) => {
    await expect(new AiService().normalize({ text } as never, [])).rejects.toMatchObject({ status: 400 });
  });

  it('rejects more than five offline products without dropping any', () => {
    expect(() => new AiService().normalizeProduct({ text: 'a;b;c;d;e;f' })).toThrow(/5 sản phẩm/);
  });

  it.each(['authentication', 'timeout', 'rate_limit'])('labels fallback after %s without exposing provider error', async (failure) => {
    vi.spyOn(GeminiProductVision, 'isConfigured').mockReturnValue(true);
    vi.spyOn(GeminiProductVision.prototype, 'normalizeText').mockRejectedValue(new Error(`secret-key ${failure}`));
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    await expect(new AiService().normalize({ text: 'coca' }, [])).rejects.toMatchObject({ status: 503 });
  });
  it('propagates quota errors without generating an offline suggestion', async () => {
    vi.spyOn(GeminiProductVision, 'isConfigured').mockReturnValue(true);
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.spyOn(GeminiProductVision.prototype, 'normalizeText').mockRejectedValue({ status: 429 });
    await expect(new AiService().normalize({ text: 'coca' }, [])).rejects.toMatchObject({ status: 429, response: { code: 'AI_USAGE_LIMITED' } });
  });
});
