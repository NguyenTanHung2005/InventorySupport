import { AiResult, AiStatus, AssistantReply, InvoiceScanResult } from '../types';
import { request } from './api';

export const aiService = {
  status: (token: string) => request<AiStatus>('/ai/status', { token }),

  normalizeProduct: (token: string, text: string) =>
    request<AiResult>('/ai/normalize-product', { method: 'POST', token, body: { text } }),

  /** imageUrl là đường dẫn trả về từ uploadService.uploadImage. */
  scanImage: (token: string, imageUrl: string, note?: string) =>
    request<AiResult>('/ai/scan-image', { method: 'POST', token, body: { imageUrl, note } }),

  /** Đọc phiếu nhập / hóa đơn từ ảnh đã tải lên. Không ghi dữ liệu. */
  scanInvoice: (token: string, imageUrl: string) =>
    request<InvoiceScanResult>('/ai/scan-invoice', { method: 'POST', token, body: { imageUrl } }),

  /** Hỏi trợ lý; bỏ trống sessionId để bắt đầu cuộc trò chuyện mới. */
  chat: (token: string, message: string, sessionId?: string) =>
    request<AssistantReply>('/ai/assistant/chat', { method: 'POST', token, body: { message, sessionId } }),

  resetSession: (token: string, sessionId: string) =>
    request<{ deleted: boolean }>(`/ai/assistant/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE', token }),
};
