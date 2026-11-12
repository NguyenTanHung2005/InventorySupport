/**
 * Phân tích chuỗi đọc được từ camera (docs/SCAN.md mục 2.1).
 * Backend là nơi duy nhất quyết định một mã là gì, để mọi client dùng chung luật.
 */

export type ScanFormat = 'APP_QR' | 'GS1_DIGITAL_LINK' | 'BARCODE' | 'TEXT';

export interface ParsedScanCode {
  raw: string;
  /** Mã sản phẩm sau khi tách khỏi QR/URL. */
  code: string;
  format: ScanFormat;
  /** Các dạng tương đương để tìm (EAN-13 / UPC-A / GTIN-14). */
  candidates: string[];
}

/** Tiền tố tem QR do app tạo: `IS:P:<barcode>`. */
export const APP_QR_PREFIX = 'IS:P:';

export function buildProductQrPayload(barcode: string): string {
  return `${APP_QR_PREFIX}${barcode}`;
}

const MAX_RAW_LENGTH = 512;

export function parseScanCode(input: string): ParsedScanCode {
  const raw = input.trim().slice(0, MAX_RAW_LENGTH);

  if (raw.toUpperCase().startsWith(APP_QR_PREFIX)) {
    const code = raw.slice(APP_QR_PREFIX.length).trim();
    return { raw, code, format: 'APP_QR', candidates: numericVariants(code) };
  }

  // GS1 Digital Link: https://<domain>/01/<GTIN>[/...][?...] - QR chuẩn mới in trên bao bì.
  const gs1 = /^https?:\/\/[^/]+(?:\/[^?#]*)?\/01\/(\d{8,14})(?:[/?#]|$)/i.exec(raw);
  if (gs1) {
    return { raw, code: gs1[1], format: 'GS1_DIGITAL_LINK', candidates: numericVariants(gs1[1]) };
  }

  if (/^\d{6,14}$/.test(raw)) {
    return { raw, code: raw, format: 'BARCODE', candidates: numericVariants(raw) };
  }

  return { raw, code: raw, format: 'TEXT', candidates: raw ? [raw] : [] };
}

/**
 * Cùng một sản phẩm có thể được trả về với độ dài khác nhau:
 * GTIN-14 "08934588012345" = EAN-13 "8934588012345"; UPC-A "012345678905" = EAN-13 "0012345678905".
 */
export function numericVariants(code: string): string[] {
  const variants = new Set<string>([code]);
  if (/^\d+$/.test(code)) {
    const stripped = code.replace(/^0+/, '');
    if (stripped.length >= 6) {
      for (const length of [8, 12, 13, 14]) {
        if (stripped.length <= length) variants.add(stripped.padStart(length, '0'));
      }
    }
  }
  return [...variants];
}
