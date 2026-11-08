import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  AuthUser,
  Product,
  StockTransaction,
  StockTransactionType,
} from '../common/types.js';
import { StockMovementDto } from './dto/stock-movement.dto.js';

@Injectable()
export class InventoryService {
  constructor(private readonly database: DatabaseService) {}

  move(dto: StockMovementDto, user: AuthUser): Product {
    const product = this.database.products.find(
      (candidate) => candidate.id === dto.productId && candidate.storeId === user.storeId,
    );
    if (!product) throw new BadRequestException('Sản phẩm không thuộc cửa hàng');
    const quantity = Number(dto.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException('Số lượng phải lớn hơn 0');
    }
    if (dto.type === StockTransactionType.EXPORT && product.quantity < quantity) {
      throw new BadRequestException('Số lượng xuất vượt quá tồn kho');
    }

    const delta = dto.type === StockTransactionType.EXPORT ? -quantity : quantity;
    product.quantity += delta;
    product.updatedAt = new Date().toISOString();
    const transaction: StockTransaction = {
      id: this.database.createId('transaction'),
      storeId: user.storeId,
      productId: product.id,
      type: dto.type,
      quantity,
      reason: dto.reason?.trim(),
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    this.database.transactions.push(transaction);
    return product;
  }

  lowStock(user: AuthUser): Product[] {
    return this.database.products.filter(
      (product) =>
        product.storeId === user.storeId && product.quantity <= product.minStock,
    );
  }

  transactions(user: AuthUser): StockTransaction[] {
    return this.database.transactions.filter(
      (transaction) => transaction.storeId === user.storeId,
    );
  }
}
