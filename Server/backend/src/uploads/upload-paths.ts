import { resolve, sep } from 'node:path';

export const UPLOAD_URL_PREFIX = '/uploads/';

export function uploadRoot(): string {
  return resolve(process.env.UPLOAD_DIR ?? 'uploads');
}

/** Chỉ chấp nhận đường dẫn `/uploads/<storeId>/<file>` thuộc đúng cửa hàng. */
export function isOwnUploadPath(url: string, storeId: string): boolean {
  return /^\/uploads\/[\w-]+\/[\w-]+\.(jpg|png|webp)$/.test(url)
    && url.startsWith(`${UPLOAD_URL_PREFIX}${storeId}/`);
}

/** Đổi URL tương đối sang đường dẫn file, chặn path traversal. */
export function resolveUploadPath(url: string): string {
  const root = uploadRoot();
  const absolute = resolve(root, url.slice(UPLOAD_URL_PREFIX.length));
  if (!absolute.startsWith(root + sep)) throw new Error('Đường dẫn ảnh không hợp lệ');
  return absolute;
}
