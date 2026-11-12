import { StockTransactionType } from '../../common/types.js';

export class StockMovementDto {
  productId = '';
  type: StockTransactionType = StockTransactionType.IMPORT;
  /**
   * IMPORT/EXPORT: số lượng nhập/xuất (> 0).
   * ADJUSTMENT: số lượng thực tế đếm được khi kiểm kê (>= 0).
   */
  quantity = 0;
  reason?: string;
}

export class StockBatchDto {
  type: StockTransactionType = StockTransactionType.IMPORT;
  /** Áp dụng cho mọi dòng; bắt buộc với ADJUSTMENT. */
  reason?: string;
  /** IMPORT/EXPORT: số lượng nhập/xuất. ADJUSTMENT: số đếm thực tế. */
  items: { productId: string; quantity: number }[] = [];
}

export interface TransactionQuery {
  page?: string;
  limit?: string;
  productId?: string;
  type?: StockTransactionType;
  /** ISO date, ví dụ 2026-11-01 */
  from?: string;
  to?: string;
}
