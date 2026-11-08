import { StockTransactionType } from '../../common/types.js';

export class StockMovementDto {
  productId = '';
  type: StockTransactionType = StockTransactionType.IMPORT;
  quantity = 0;
  reason?: string;
}
