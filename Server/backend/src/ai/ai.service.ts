import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { isOwnUploadPath, resolveUploadPath } from '../uploads/upload-paths.js';
import { ClaudeProductResult, ClaudeProductVision, ImageMediaType } from './claude-product-vision.js';
import { NormalizeProductDto } from './dto/normalize-product.dto.js';

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
  private vision?: ClaudeProductVision;

  get providerEnabled(): boolean {
    return ClaudeProductVision.isConfigured();
  }

  /**
   * Chuẩn hóa mô tả văn bản: dùng Claude nếu đã cấu hình API key,
   * lỗi hoặc chưa cấu hình thì quay về bộ luật heuristic.
   */
  async normalize(dto: NormalizeProductDto, categories: string[]): Promise<NormalizeResult> {
    const text = dto.text?.trim();
    if (!text) throw new BadRequestException('Cần nhập mô tả sản phẩm');
    if (text.length > 1000) throw new BadRequestException('Mô tả tối đa 1000 ký tự');
    if (!this.providerEnabled) return this.normalizeProduct({ text });
    try {
      return this.fromProvider(await this.getVision().normalizeText(text, categories), text);
    } catch (error) {
      this.logger.warn(`Claude lỗi, dùng heuristic: ${(error as Error).message}`);
      return this.normalizeProduct({ text });
    }
  }

  /** Nhận diện sản phẩm từ ảnh đã tải lên `/uploads/...`. Bắt buộc có AI provider. */
  async scanImage(imageUrl: string, storeId: string, categories: string[], note?: string): Promise<NormalizeResult> {
    if (!isOwnUploadPath(imageUrl, storeId)) throw new BadRequestException('Ảnh không hợp lệ');
    if (!this.providerEnabled) {
      throw new ServiceUnavailableException(
        'Chưa cấu hình AI nhận diện ảnh (thiếu ANTHROPIC_API_KEY trên server). Hãy quét barcode hoặc nhập mô tả bằng chữ.',
      );
    }
    let base64: string;
    try {
      base64 = readFileSync(resolveUploadPath(imageUrl)).toString('base64');
    } catch {
      throw new BadRequestException('Không tìm thấy ảnh đã tải lên');
    }
    const mediaType = MEDIA_TYPES[imageUrl.split('.').pop() ?? ''] ?? 'image/jpeg';
    try {
      const result = await this.getVision().analyzeImage({ base64, mediaType }, categories, note?.slice(0, 300));
      return this.fromProvider(result, result.correctedText || 'Ảnh sản phẩm');
    } catch (error) {
      this.logger.error(`Nhận diện ảnh thất bại: ${(error as Error).message}`);
      throw new ServiceUnavailableException('AI chưa nhận diện được ảnh, vui lòng thử lại hoặc chụp rõ hơn');
    }
  }

  private getVision(): ClaudeProductVision {
    this.vision ??= new ClaudeProductVision();
    return this.vision;
  }

  private fromProvider(result: ClaudeProductResult, input: string): NormalizeResult {
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
    const parts = correctedText.split(/[,;|\n]+/).map((part) => part.trim()).filter(Boolean);
    const suggestions = (parts.length > 1 ? parts : [correctedText]).map((part) => this.toSuggestion(part, dto.imageUrl));
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

  private toSuggestion(value: string, imageUrl?: string): ProductSuggestion {
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
            : 'cái';
    const normalizedName = this.toVietnameseTitleCase(value);
    return {
      name: value,
      normalizedName,
      category,
      unit,
      description: `${normalizedName} thuộc nhóm ${category.toLocaleLowerCase('vi-VN')}, đơn vị tính ${unit}.`,
      confidence: imageUrl ? 0.6 : 0.8,
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
      .replace(/\s+/g, ' ')
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
