import { StockTransactionType } from '../../common/types.js';

/** Sản phẩm rút gọn trả cho model và hiển thị thẻ trên mobile. */
export interface AssistantProduct {
  id: string;
  name: string;
  barcode: string;
  category: string;
  unit: string;
  quantity: number;
  minStock: number;
  price: number;
  /** Chỉ có với người được xem giá nhập. */
  costPrice?: number;
  imageUrl?: string;
  status: 'OK' | 'LOW' | 'OUT';
}

export type AssistantAction =
  | {
      id: string;
      kind: 'STOCK_MOVEMENT';
      productId: string;
      productName: string;
      unit: string;
      type: StockTransactionType;
      quantity: number;
      reason?: string;
      currentQuantity: number;
    }
  | {
      id: string;
      kind: 'CREATE_PRODUCT';
      prefill: {
        name: string;
        category?: string;
        unit?: string;
        price?: number;
        costPrice?: number;
        barcode?: string;
        description?: string;
      };
    };

export interface AssistantToolCall {
  name: string;
  summary: string;
}

export interface AssistantReply {
  sessionId: string;
  provider: 'claude' | 'offline';
  reply: string;
  products: AssistantProduct[];
  actions: AssistantAction[];
  toolCalls: AssistantToolCall[];
  turn: number;
  maxTurns: number;
}

export class AssistantChatDto {
  sessionId?: string;
  message = '';
}
