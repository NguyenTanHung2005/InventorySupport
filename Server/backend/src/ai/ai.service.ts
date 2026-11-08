import { BadRequestException, Injectable } from '@nestjs/common';
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
}

export interface NormalizeResult extends NormalizedProduct {
  suggestions: ProductSuggestion[];
  hasMultipleProductTypes: boolean;
  correctedText: string;
}

@Injectable()
export class AiService {
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
