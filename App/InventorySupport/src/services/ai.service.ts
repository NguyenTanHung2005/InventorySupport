import { AiResult, AiStatus, AiSuggestion, AssistantReply, InvoiceLine, InvoiceScanResult, ProductInput } from '../types';
import { request } from './api';

export const aiService = {
  invoiceCandidate: ({ candidates, unit }: Pick<InvoiceLine, 'candidates' | 'unit'>) =>
    candidates.length === 1 && unit.trim() && candidates[0].unit.trim().toLocaleLowerCase('vi-VN') === unit.trim().toLocaleLowerCase('vi-VN') ? candidates[0] : undefined,
  productInput: (suggestion: AiSuggestion): ProductInput => ({
    name: suggestion.normalizedName, description: suggestion.description,
    category: suggestion.category, unit: suggestion.unit, barcode: suggestion.barcode,
  }),
  status: (token: string) => request<AiStatus>('/ai/status', { token }),

  normalizeProduct: (token: string, text: string) =>
    request<AiResult>('/ai/normalize-product', { method: 'POST', token, body: { text }, timeoutMs: 40_000 }),

  /** imageUrl là đường dẫn trả về từ uploadService.uploadImage. */
  scanImage: (token: string, imageUrl: string, note?: string) =>
    request<AiResult>('/ai/scan-image', { method: 'POST', token, body: { imageUrl, note }, timeoutMs: 40_000 }),

  /** Đọc phiếu nhập / hóa đơn từ ảnh đã tải lên. Không ghi dữ liệu. */
  scanInvoice: (token: string, imageUrl: string) =>
    request<InvoiceScanResult>('/ai/scan-invoice', { method: 'POST', token, body: { imageUrl }, timeoutMs: 40_000 }),

  /** Hỏi trợ lý; bỏ trống sessionId để bắt đầu cuộc trò chuyện mới. */
  chat: (token: string, message: string, sessionId?: string) =>
    request<AssistantReply>('/ai/assistant/chat', { method: 'POST', token, body: { message, sessionId }, timeoutMs: 70_000 }),

  resetSession: (token: string, sessionId: string) =>
    request<{ deleted: boolean }>(`/ai/assistant/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE', token }),

  confirmAction: (token: string, sessionId: string, actionId: string, transactionId: string) =>
    request<{ confirmed: boolean }>(`/ai/assistant/sessions/${encodeURIComponent(sessionId)}/actions/${encodeURIComponent(actionId)}/confirm`, { method: 'POST', token, body: { transactionId }, timeoutMs: 10_000 }),
};
