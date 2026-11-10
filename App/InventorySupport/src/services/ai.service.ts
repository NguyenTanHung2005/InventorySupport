import { AiResult } from '../types';
import { request } from './api';

export const aiService = {
  status: (token: string) => request<{ provider: 'claude' | 'heuristic' }>('/ai/status', { token }),

  normalizeProduct: (token: string, text: string) =>
    request<AiResult>('/ai/normalize-product', { method: 'POST', token, body: { text } }),

  /** imageUrl là đường dẫn trả về từ uploadService.uploadImage. */
  scanImage: (token: string, imageUrl: string, note?: string) =>
    request<AiResult>('/ai/scan-image', { method: 'POST', token, body: { imageUrl, note } }),
};
