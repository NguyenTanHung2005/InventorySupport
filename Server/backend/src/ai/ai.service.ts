import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { isOwnUploadPath, resolveUploadPath } from '../uploads/upload-paths.js';
import {
  GeminiInvoiceResult,
  GeminiProductResult,
  GeminiProductVision,
  ImageMediaType,
} from './gemini-product-vision.js';
import { geminiError } from './gemini-errors.js';
import { NormalizeProductDto } from './dto/normalize-product.dto.js';
import { requiredString } from '../common/validation.js';

export interface NormalizedProduct {
  name: string;
  normalizedName: string;
  category: string;
  unit: string;
  description: string;
  confidence: number;
  source: 'heuristic' | 'provider';
}

export interface ProductSuggestion extends NormalizedProduct {
  matchedTerms: string[];
  /** Mã vạch AI đọc được trên ảnh (nếu có). */
  barcode?: string;
}

export interface NormalizeResult extends NormalizedProduct {
  fallbackReason?: 'not_configured' | 'provider_unavailable';
  suggestions: ProductSuggestion[];
  hasMultipleProductTypes: boolean;
  correctedText: string;
}

const MEDIA_TYPES: Record<string, ImageMediaType> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private vision?: GeminiProductVision;

  get providerEnabled(): boolean {
    return GeminiProductVision.isConfigured();
  }

  /**
   * Chuẩn hóa mô tả bằng Gemini; báo lỗi khi chưa cấu hình hoặc dịch vụ không khả dụng.
   */
  async normalize(dto: NormalizeProductDto, categories: string[]): Promise<NormalizeResult> {
    const text = requiredString(dto?.text, 'Tên hoặc mô tả sản phẩm', 1000);
    if (!this.providerEnabled) throw new ServiceUnavailableException('Chức năng AI chưa được cấu hình. Bạn vẫn có thể thao tác thủ công.');
    try {
      return this.fromProvider(await this.getVision().normalizeText(text, categories), text);
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw geminiError(error);
    }
  }

  /** Đọc phiếu giao hàng / hóa đơn nhập từ ảnh đã tải lên (docs/SCAN.md mục 3.2). */
  async scanInvoice(imageUrl: string, storeId: string): Promise<GeminiInvoiceResult> {
    const image = this.loadImage(imageUrl, storeId);
    try {
      return await this.getVision().readDeliveryNote(image);
    } catch (error) {
      throw geminiError(error);
    }
  }

  /** Kiểm tra quyền sở hữu ảnh + cấu hình AI, rồi đọc ảnh thành base64. */
  private loadImage(imageUrl: string, storeId: string): { base64: string; mediaType: ImageMediaType } {
    if (!isOwnUploadPath(imageUrl, storeId)) throw new BadRequestException('Ảnh không hợp lệ');
    if (!this.providerEnabled) {
      throw new ServiceUnavailableException(
        'Chưa cấu hình AI nhận diện ảnh (thiếu GEMINI_API_KEY trên server). Hãy quét mã vạch hoặc nhập bằng tay.',
      );
    }
    let base64: string;
    try {
      base64 = readFileSync(resolveUploadPath(imageUrl)).toString('base64');
    } catch {
      throw new BadRequestException('Không tìm thấy ảnh đã tải lên');
    }
    return { base64, mediaType: MEDIA_TYPES[imageUrl.split('.').pop() ?? ''] ?? 'image/jpeg' };
  }

  /** Nhận diện sản phẩm từ ảnh đã tải lên `/uploads/...`. Bắt buộc có AI provider. */
  async scanImage(imageUrl: string, storeId: string, categories: string[], note?: string): Promise<NormalizeResult> {
    const image = this.loadImage(imageUrl, storeId);
    try {
      const result = await this.getVision().analyzeImage(image, categories, note?.slice(0, 300));
      return this.fromProvider(result, result.correctedText || 'Ảnh sản phẩm');
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw geminiError(error);
    }
  }

  private getVision(): GeminiProductVision {
    this.vision ??= new GeminiProductVision();
    return this.vision;
  }

  private fromProvider(result: GeminiProductResult, input: string): NormalizeResult {
    const suggestions: ProductSuggestion[] = result.suggestions.map((item) => ({
      name: item.name,
      normalizedName: item.normalizedName,
      category: item.category,
      unit: item.unit,
      description: item.description,
      confidence: item.confidence,
      source: 'provider',
      matchedTerms: [],
      barcode: item.barcode || undefined,
    }));
    const primary = suggestions[0] ?? {
      name: input,
      normalizedName: '',
      category: 'Khác',
      unit: 'cái',
      description: 'Không nhận diện được sản phẩm.',
      confidence: 0,
      source: 'provider' as const,
    };
    return {
      ...primary,
      name: input,
      normalizedName: suggestions.map((item) => item.normalizedName).join(', '),
      description: suggestions.length > 1
        ? `Phát hiện ${suggestions.length} sản phẩm: ${suggestions.map((item) => item.normalizedName).join('; ')}.`
        : primary.description,
      correctedText: result.correctedText,
      suggestions,
      hasMultipleProductTypes: new Set(suggestions.map((item) => item.category)).size > 1,
    };
  }

  /** Bộ luật heuristic (không cần mạng) - dùng khi chưa cấu hình AI provider. */
  normalizeProduct(dto: NormalizeProductDto): NormalizeResult {
    const input = dto.text?.trim();
    if (!input && !dto.imageUrl) {
      throw new BadRequestException('Cần cung cấp text hoặc imageUrl');
    }

    const text = input || 'Sản phẩm từ hình ảnh';
    const correctedText = this.correctSpelling(text);
    const parts = correctedText.split(/(?<!\d),|,(?!\d)|[;|\n]+/).map((part) => part.trim()).filter(Boolean);
    if (parts.length > 5) throw new BadRequestException('Tối đa 5 sản phẩm mỗi lần. Hãy chia nhỏ nội dung.');
    const suggestions = (parts.length > 1 ? parts : [correctedText]).map((part) => this.toSuggestion(part));
    const categories = new Set(suggestions.map((suggestion) => suggestion.category));
    const primary = suggestions[0];

    return {
      ...primary,
      name: correctedText,
      normalizedName: suggestions.length > 1
        ? suggestions.map((suggestion) => suggestion.normalizedName).join(', ')
        : primary.normalizedName,
      description: suggestions.length > 1
        ? `Phát hiện ${suggestions.length} sản phẩm: ${suggestions.map((suggestion) => suggestion.normalizedName).join('; ')}.`
        : primary.description,
      suggestions,
      hasMultipleProductTypes: suggestions.length > 1 && categories.size > 1,
      correctedText,
    };
  }

  private toSuggestion(value: string): ProductSuggestion {
    const lower = value.toLocaleLowerCase('vi-VN');
    const category = lower.includes('coca') || lower.includes('pepsi') || lower.includes('nước ngọt')
      ? 'Nước giải khát'
      : lower.includes('bánh') || lower.includes('snack')
        ? 'Đồ ăn nhẹ'
        : lower.includes('đá') || lower.includes('đá viên')
          ? 'Đá lạnh'
          : 'Khác';
    const unit = lower.includes('chai')
      ? 'chai'
      : lower.includes('lon')
        ? 'lon'
        : lower.includes('gói')
          ? 'gói'
          : lower.includes('kg')
            ? 'kg'
            : '';
    const normalizedName = this.toVietnameseTitleCase(value);
    return {
      name: value,
      normalizedName,
      category,
      unit,
      description: 'Gợi ý nhập liệu cơ bản từ bộ luật offline. Hãy bổ sung và kiểm tra mô tả sản phẩm.',
      confidence: 0,
      source: 'heuristic',
      matchedTerms: value.split(/\s+/).filter((term) => term.length > 2),
    };
  }

  private correctSpelling(value: string): string {
    const corrections: Record<string, string> = {
      nuoc: 'nước',
      ngot: 'ngọt',
      da: 'đá',
      vien: 'viên',
      banh: 'bánh',
      sua: 'sữa',
      ca: 'cá',
    };
    return value
      .toLocaleLowerCase('vi-VN')
      .replace(/[^\S\n]+/g, ' ')
      .trim()
      .split(/(\s+)/)
      .map((part) => {
        const word = part.replace(/[^\p{L}\d]/gu, '');
        const corrected = corrections[word];
        return corrected ? part.replace(word, corrected) : part;
      })
      .join('');
  }

  private toVietnameseTitleCase(value: string): string {
    return value
      .toLocaleLowerCase('vi-VN')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/(^|[\s-])(\p{L})/gu, (_match, separator: string, letter: string) => (
        `${separator}${letter.toLocaleUpperCase('vi-VN')}`
      ));
  }
}
