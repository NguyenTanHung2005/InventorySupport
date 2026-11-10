import Anthropic from '@anthropic-ai/sdk';
import { betaJSONSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/beta/json-schema';

/**
 * Gọi Claude để (1) nhận diện sản phẩm từ ảnh chụp và (2) chuẩn hóa mô tả văn bản.
 * Chỉ chạy trên backend: API key không bao giờ xuống tới mobile.
 */

const SUGGESTION_SCHEMA = {
  type: 'object',
  properties: {
    correctedText: {
      type: 'string',
      description: 'Mô tả đầu vào sau khi sửa lỗi chính tả tiếng Việt; với ảnh thì là mô tả ngắn những gì nhìn thấy.',
    },
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Tên như xuất hiện trên bao bì/đầu vào' },
          normalizedName: { type: 'string', description: 'Tên chuẩn: Thương hiệu + loại + quy cách, ví dụ "Coca-Cola 390ml"' },
          category: { type: 'string' },
          unit: { type: 'string', description: 'Đơn vị tính: chai, lon, gói, hộp, kg, cái, thùng...' },
          description: { type: 'string', description: 'Mô tả ngắn 1-2 câu tiếng Việt' },
          barcode: { type: 'string', description: 'Dãy số mã vạch đọc được rõ ràng trên ảnh, để rỗng nếu không thấy' },
          confidence: { type: 'number', description: 'Độ tin cậy 0..1' },
        },
        required: ['name', 'normalizedName', 'category', 'unit', 'description', 'barcode', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['correctedText', 'suggestions'],
  additionalProperties: false,
} as const;

export interface ClaudeProductResult {
  correctedText: string;
  suggestions: Array<{
    name: string;
    normalizedName: string;
    category: string;
    unit: string;
    description: string;
    barcode: string;
    confidence: number;
  }>;
}

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp';

const SYSTEM_PROMPT = `Bạn là trợ lý nhập liệu cho ứng dụng kiểm kê của cửa hàng tạp hóa nhỏ tại Việt Nam.
Nhiệm vụ: xác định sản phẩm và trả về thông tin chuẩn hóa để nhân viên xác nhận trước khi lưu.
- Mỗi loại sản phẩm khác nhau là một phần tử trong "suggestions" (tối đa 5).
- Ưu tiên dùng một danh mục có sẵn của cửa hàng nếu phù hợp; chỉ đặt danh mục mới khi không có danh mục nào khớp.
- Chỉ điền barcode khi đọc được đầy đủ dãy số trên ảnh; không được đoán.
- Nếu ảnh không chứa sản phẩm bán lẻ nào, trả về suggestions rỗng.
- Hạ "confidence" khi chữ trên bao bì mờ hoặc bạn phải suy đoán.`;

export class ClaudeProductVision {
  private readonly client = new Anthropic();
  private readonly model = process.env.AI_MODEL ?? 'claude-opus-5-5';

  static isConfigured(): boolean {
    return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  }

  analyzeImage(image: { base64: string; mediaType: ImageMediaType }, categories: string[], note?: string) {
    return this.run(
      [
        { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } },
        {
          type: 'text',
          text: `Danh mục hiện có: ${categories.join(', ') || '(chưa có)'}.\n${
            note ? `Ghi chú của nhân viên: ${note}\n` : ''
          }Hãy nhận diện các sản phẩm trong ảnh.`,
        },
      ],
    );
  }

  normalizeText(text: string, categories: string[]) {
    return this.run([
      {
        type: 'text',
        text: `Danh mục hiện có: ${categories.join(', ') || '(chưa có)'}.\nMô tả do nhân viên gõ (có thể sai chính tả, không dấu, nhiều sản phẩm cách nhau bởi dấu phẩy):\n<input>${text}</input>`,
      },
    ]);
  }

  private async run(content: Anthropic.Beta.BetaContentBlockParam[]): Promise<ClaudeProductResult> {
    const response = await this.client.beta.messages.parse({
      model: this.model,
      max_tokens: 4000,
      // Nếu model chính từ chối vì bộ lọc an toàn, server tự chạy lại trên model dự phòng.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      // Tác vụ trích xuất đơn giản: effort thấp để phản hồi nhanh và tiết kiệm.
      output_config: { effort: 'low', format: betaJSONSchemaOutputFormat(SUGGESTION_SCHEMA) },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    });

    if (response.stop_reason === 'refusal') {
      throw new Error('AI từ chối xử lý yêu cầu này');
    }
    if (!response.parsed_output) {
      throw new Error(`AI không trả về kết quả hợp lệ (stop_reason: ${response.stop_reason})`);
    }
    const output = response.parsed_output as ClaudeProductResult;
    return {
      correctedText: output.correctedText,
      suggestions: output.suggestions.slice(0, 5).map((item) => ({
        ...item,
        confidence: Math.min(1, Math.max(0, Number(item.confidence) || 0)),
        barcode: /^\d{6,14}$/.test(item.barcode.trim()) ? item.barcode.trim() : '',
      })),
    };
  }
}
