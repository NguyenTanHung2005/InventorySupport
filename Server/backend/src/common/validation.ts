import { BadRequestException } from '@nestjs/common';
import { Paginated } from './types.js';

/** Các hàm kiểm tra đầu vào nhỏ gọn, dùng chung cho mọi DTO. */

export function requiredString(value: unknown, field: string, maxLength = 200): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) throw new BadRequestException(`${field} là bắt buộc`);
  if (text.length > maxLength) {
    throw new BadRequestException(`${field} tối đa ${maxLength} ký tự`);
  }
  return text;
}

export function optionalString(value: unknown, field: string, maxLength = 2000): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new BadRequestException(`${field} phải là chuỗi`);
  const text = value.trim();
  if (text.length > maxLength) {
    throw new BadRequestException(`${field} tối đa ${maxLength} ký tự`);
  }
  return text;
}

export function optionalNumber(
  value: unknown,
  field: string,
  { min = 0, max = Number.MAX_SAFE_INTEGER, integer = false } = {},
): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new BadRequestException(`${field} phải là số`);
  if (integer && !Number.isInteger(number)) {
    throw new BadRequestException(`${field} phải là số nguyên`);
  }
  if (number < min || number > max) {
    throw new BadRequestException(`${field} phải nằm trong khoảng ${min} - ${max}`);
  }
  return number;
}

export function requiredNumber(
  value: unknown,
  field: string,
  options: { min?: number; max?: number; integer?: boolean } = {},
): number {
  const number = optionalNumber(value, field, options);
  if (number === undefined) throw new BadRequestException(`${field} là bắt buộc`);
  return number;
}

export function requiredEnum<T extends string>(value: unknown, values: readonly T[], field: string): T {
  if (typeof value === 'string' && (values as readonly string[]).includes(value)) {
    return value as T;
  }
  throw new BadRequestException(`${field} phải là một trong: ${values.join(', ')}`);
}

export function requiredEmail(value: unknown): string {
  const email = requiredString(value, 'Email', 120).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException('Email không hợp lệ');
  }
  return email;
}

export function requiredPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 6) {
    throw new BadRequestException('Mật khẩu phải có ít nhất 6 ký tự');
  }
  if (value.length > 128) throw new BadRequestException('Mật khẩu quá dài');
  return value;
}

export interface PageQuery {
  page: number;
  limit: number;
}

export function parsePageQuery(query: { page?: unknown; limit?: unknown }): PageQuery {
  return {
    page: optionalNumber(query.page, 'page', { min: 1, integer: true }) ?? 1,
    limit: optionalNumber(query.limit, 'limit', { min: 1, max: 100, integer: true }) ?? 20,
  };
}

export function paginate<T>(items: T[], { page, limit }: PageQuery): Paginated<T> {
  const total = items.length;
  return {
    items: items.slice((page - 1) * limit, page * limit),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
