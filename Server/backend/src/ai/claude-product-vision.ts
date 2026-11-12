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

const INVOICE_SCHEMA = {
  type: 'object',
  properties: {
    readable: { type: 'boolean', description: 'false nếu ảnh không phải phiếu/hóa đơn hàng hóa hoặc quá mờ để đọc' },
    supplier: { type: 'string', description: 'Tên nhà cung cấp/người bán, rỗng nếu không có' },
    date: { type: 'string', description: 'Ngày trên phiếu dạng YYYY-MM-DD, rỗng nếu không có' },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Tên hàng như in trên phiếu' },
          quantity: { type: 'number', description: 'Số lượng theo đơn vị tính của dòng' },
          unit: { type: 'string', description: 'Đơn vị tính in trên phiếu: chai, thùng, gói...; rỗng nếu không có' },
          unitPrice: { type: 'number', description: 'Đơn giá VND, 0 nếu không có' },
          barcode: { type: 'string', description: 'Mã vạch/mã hàng dạng số nếu in rõ trên dòng, rỗng nếu không' },
          confidence: { type: 'number', description: 'Độ tin cậy 0..1 cho dòng này' },
        },
        required: ['name', 'quantity', 'unit', 'unitPrice', 'barcode', 'confidence'],
        additionalProperties: false,
      },
    },
  },
  required: ['readable', 'supplier', 'date', 'lines'],
  additionalProperties: false,
} as const;

export interface ClaudeInvoiceResult {
  readable: boolean;
  supplier: string;
  date: string;
  lines: Array<{ name: string; quantity: number; unit: string; unitPrice: number; barcode: string; confidence: number }>;
}

const INVOICE_PROMPT = `Bạn đọc phiếu giao hàng / hóa đơn nhập hàng cho cửa hàng tạp hóa nhỏ tại Việt Nam.
- Mỗi dòng hàng hóa là một phần tử trong "lines"; bỏ qua dòng tổng cộng, thuế, chiết khấu, phí vận chuyển.
- Đọc đúng số lượng và đơn giá như in trên phiếu (chữ viết tay cũng đọc nếu rõ). Dấu chấm trong số tiền là phân cách hàng nghìn.
- Không đoán: chữ không đọc được thì hạ confidence; mã vạch chỉ điền khi đọc đủ dãy số.
- Nếu ảnh không phải phiếu hàng hóa, đặt readable=false và lines rỗng.`;

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

  /** Đọc phiếu giao hàng / hóa đơn nhập (docs/SCAN.md mục 3.2). */
  async readDeliveryNote(image: { base64: string; mediaType: ImageMediaType }): Promise<ClaudeInvoiceResult> {
    const response = await this.client.beta.messages.parse({
      model: this.model,
      // Phiếu có thể nhiều dòng; chừa chỗ cho cả phần suy luận.
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaJSONSchemaOutputFormat(INVOICE_SCHEMA) },
      system: INVOICE_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } },
            { type: 'text', text: 'Trích các dòng hàng hóa trên phiếu này.' },
          ],
        },
      ],
    });
    const output = this.checkParsed(response) as ClaudeInvoiceResult;
    return {
      supplier: output.supplier.trim(),
      date: output.date.trim(),
      readable: output.readable,
      lines: output.lines.slice(0, 100).map((line) => ({
        name: line.name.trim(),
        quantity: Math.max(0, Math.round(Number(line.quantity) || 0)),
        unit: line.unit.trim(),
        unitPrice: Math.max(0, Number(line.unitPrice) || 0),
        barcode: /^\d{6,14}$/.test(line.barcode.trim()) ? line.barcode.trim() : '',
        confidence: Math.min(1, Math.max(0, Number(line.confidence) || 0)),
      })),
    };
  }

  private checkParsed(response: { stop_reason: string | null; parsed_output: unknown }): unknown {
    if (response.stop_reason === 'refusal') {
      throw new Error('AI từ chối xử lý yêu cầu này');
    }
    if (!response.parsed_output) {
      throw new Error(`AI không trả về kết quả hợp lệ (stop_reason: ${response.stop_reason})`);
    }
    return response.parsed_output;
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

    const output = this.checkParsed(response) as ClaudeProductResult;
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
