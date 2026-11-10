import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AuthUser } from '../common/types.js';
import { UPLOAD_URL_PREFIX, uploadRoot } from './upload-paths.js';

const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export class UploadImageDto {
  /** Dữ liệu ảnh base64 (có hoặc không có tiền tố `data:image/...;base64,`). */
  base64 = '';
  mimeType = 'image/jpeg';
}

@Injectable()
export class UploadsService {
  saveImage(user: AuthUser, dto: UploadImageDto) {
    let base64 = String(dto.base64 ?? '');
    let mimeType = String(dto.mimeType ?? 'image/jpeg').toLowerCase();
    const dataUrl = /^data:([^;]+);base64,(.*)$/s.exec(base64);
    if (dataUrl) {
      mimeType = dataUrl[1].toLowerCase();
      base64 = dataUrl[2];
    }
    const extension = EXTENSIONS[mimeType];
    if (!extension) throw new BadRequestException('Chỉ hỗ trợ ảnh JPEG, PNG hoặc WEBP');

    const buffer = Buffer.from(base64, 'base64');
    if (!buffer.length) throw new BadRequestException('Ảnh rỗng');
    if (buffer.length > MAX_BYTES) throw new BadRequestException('Ảnh tối đa 5MB');
    if (!this.matchesSignature(buffer, extension)) {
      throw new BadRequestException('Nội dung file không phải ảnh hợp lệ');
    }

    const folder = join(uploadRoot(), user.storeId);
    mkdirSync(folder, { recursive: true });
    const fileName = `${randomUUID()}.${extension}`;
    writeFileSync(join(folder, fileName), buffer);
    return { url: `${UPLOAD_URL_PREFIX}${user.storeId}/${fileName}`, size: buffer.length };
  }

  /** Kiểm tra "magic bytes" để không lưu file giả mạo đuôi ảnh. */
  private matchesSignature(buffer: Buffer, extension: string): boolean {
    if (extension === 'jpg') return buffer[0] === 0xff && buffer[1] === 0xd8;
    if (extension === 'png') return buffer.subarray(0, 4).toString('hex') === '89504e47';
    return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
  }
}
