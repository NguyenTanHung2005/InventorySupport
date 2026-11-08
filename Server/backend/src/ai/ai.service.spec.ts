import { AiService } from './ai.service.js';

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
});
