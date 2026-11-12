import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  AuthUser,
  Product,
  StockTransaction,
  StockTransactionType,
} from '../common/types.js';
import { hasPermission, Permission } from '../common/permissions.js';
import {
  optionalString,
  paginate,
  parsePageQuery,
  requiredEnum,
  requiredNumber,
  requiredString,
} from '../common/validation.js';
import { ProductsService } from '../products/products.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { StockBatchDto, StockMovementDto, TransactionQuery } from './dto/stock-movement.dto.js';

const MAX_BATCH_ITEMS = 200;

const PERMISSION_BY_TYPE: Record<StockTransactionType, Permission> = {
  [StockTransactionType.IMPORT]: Permission.STOCK_IMPORT,
  [StockTransactionType.EXPORT]: Permission.STOCK_EXPORT,
  [StockTransactionType.ADJUSTMENT]: Permission.STOCK_ADJUST,
};

@Injectable()
export class InventoryService {
  constructor(
    private readonly database: DatabaseService,
    private readonly products: ProductsService,
    private readonly notifications: NotificationsService,
  ) {}

  move(dto: StockMovementDto, user: AuthUser) {
    const type = this.checkType(dto.type, user);
    const reason = this.checkReason(type, dto.reason);
    const planned = this.plan(user, type, dto.productId, dto.quantity);
    const result = this.apply(user, type, planned, reason);
    this.database.save();
    return result;
  }

  /**
   * Nhập / xuất / kiểm kê nhiều sản phẩm một lần (docs/SCAN.md mục 2.3).
   * Kiểm tra TẤT CẢ dòng trước, chỉ ghi khi mọi dòng hợp lệ: không có trạng thái ghi dở.
   */
  moveBatch(dto: StockBatchDto, user: AuthUser) {
    const type = this.checkType(dto.type, user);
    const reason = this.checkReason(type, dto.reason);
    if (!Array.isArray(dto.items) || !dto.items.length) throw new BadRequestException('Danh sách sản phẩm trống');
    if (dto.items.length > MAX_BATCH_ITEMS) throw new BadRequestException(`Tối đa ${MAX_BATCH_ITEMS} dòng mỗi lần`);
    const ids = dto.items.map((item) => String(item?.productId ?? ''));
    if (new Set(ids).size !== ids.length) throw new BadRequestException('Một sản phẩm xuất hiện nhiều lần trong danh sách');

    const planned = dto.items.map((item, index) => {
      try {
        return this.plan(user, type, item?.productId, item?.quantity);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'không hợp lệ';
        throw new BadRequestException(`Dòng ${index + 1}: ${message}`);
      }
    });
    const results = planned.map((item) => this.apply(user, type, item, reason));
    this.database.save();
    return {
      count: results.length,
      transactions: results.map((result) => result.transaction),
      products: results.map((result) => result.product),
      alerts: results.flatMap((result) => (result.alert ? [result.alert] : [])),
    };
  }

  private checkType(value: unknown, user: AuthUser): StockTransactionType {
    const type = requiredEnum(value, Object.values(StockTransactionType), 'Loại giao dịch');
    if (!hasPermission(user.role, PERMISSION_BY_TYPE[type])) {
      throw new ForbiddenException(
        type === StockTransactionType.IMPORT
          ? 'Bạn không có quyền nhập kho'
          : type === StockTransactionType.EXPORT
            ? 'Bạn không có quyền xuất kho'
            : 'Bạn không có quyền kiểm kê',
      );
    }
    return type;
  }

  private checkReason(type: StockTransactionType, value: unknown): string | undefined {
    const reason = optionalString(value, 'Ghi chú', 300);
    if (type === StockTransactionType.ADJUSTMENT && !reason) {
      throw new BadRequestException('Kiểm kê cần ghi rõ lý do chênh lệch');
    }
    return reason;
  }

  /** Kiểm tra một dòng, chưa ghi gì. */
  private plan(user: AuthUser, type: StockTransactionType, productId: unknown, rawQuantity: unknown) {
    const product = this.products.findById(requiredString(productId, 'Sản phẩm'), user);
    const isAdjustment = type === StockTransactionType.ADJUSTMENT;
    const quantity = requiredNumber(rawQuantity, 'Số lượng', { min: isAdjustment ? 0 : 1, integer: true });
    if (type === StockTransactionType.EXPORT && product.quantity < quantity) {
      throw new BadRequestException(`Số lượng xuất vượt quá tồn kho (${product.name} còn ${product.quantity} ${product.unit})`);
    }
    return { product, quantity };
  }

  private apply(
    user: AuthUser,
    type: StockTransactionType,
    { product, quantity }: { product: Product; quantity: number },
    reason?: string,
  ) {
    const isAdjustment = type === StockTransactionType.ADJUSTMENT;
    const before = product.quantity;
    const after = isAdjustment
      ? quantity
      : before + (type === StockTransactionType.EXPORT ? -quantity : quantity);
    product.quantity = after;
    product.updatedAt = new Date().toISOString();

    const transaction: StockTransaction = {
      id: this.database.createId('transaction'),
      storeId: user.storeId,
      productId: product.id,
      productName: product.name,
      type,
      quantity: isAdjustment ? after - before : quantity,
      quantityBefore: before,
      quantityAfter: after,
      reason,
      createdBy: user.id,
      createdByName: user.name,
      createdAt: product.updatedAt,
    };
    this.database.transactions.push(transaction);
    const alert = this.notifications.onStockChanged(product, before);
    // Nơi gọi (move / moveBatch) lưu file một lần sau khi ghi xong.
    return { product, transaction, alert };
  }

  lowStock(user: AuthUser): Product[] {
    return this.products
      .active(user)
      .filter((product) => product.quantity <= product.minStock)
      .sort((a, b) => a.quantity - b.quantity);
  }

  transactions(user: AuthUser, query: TransactionQuery) {
    return paginate(
      this.filterTransactions(user, query).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      parsePageQuery(query),
    );
  }

  /** Số liệu tổng hợp cho Dashboard và màn Báo cáo. */
  summary(user: AuthUser, query: Pick<TransactionQuery, 'from' | 'to'>) {
    const products = this.products.active(user);
    const transactions = this.filterTransactions(user, query);
    const sum = (type: StockTransactionType) =>
      transactions.filter((item) => item.type === type).reduce((total, item) => total + Math.abs(item.quantity), 0);
    const priceOf = new Map(this.database.products.map((product) => [product.id, product]));
    const exportRevenue = transactions
      .filter((item) => item.type === StockTransactionType.EXPORT)
      .reduce((total, item) => total + item.quantity * (priceOf.get(item.productId)?.price ?? 0), 0);

    const byProduct = new Map<string, { productId: string; productName: string; exported: number }>();
    for (const item of transactions.filter((entry) => entry.type === StockTransactionType.EXPORT)) {
      const entry = byProduct.get(item.productId) ?? { productId: item.productId, productName: item.productName, exported: 0 };
      entry.exported += item.quantity;
      byProduct.set(item.productId, entry);
    }

    return {
      productCount: products.length,
      totalQuantity: products.reduce((total, product) => total + product.quantity, 0),
      stockValue: products.reduce((total, product) => total + product.quantity * product.costPrice, 0),
      retailValue: products.reduce((total, product) => total + product.quantity * product.price, 0),
      lowStockCount: products.filter((product) => product.quantity <= product.minStock && product.quantity > 0).length,
      outOfStockCount: products.filter((product) => product.quantity === 0).length,
      importedQuantity: sum(StockTransactionType.IMPORT),
      exportedQuantity: sum(StockTransactionType.EXPORT),
      adjustmentCount: transactions.filter((item) => item.type === StockTransactionType.ADJUSTMENT).length,
      transactionCount: transactions.length,
      exportRevenue,
      topExported: [...byProduct.values()].sort((a, b) => b.exported - a.exported).slice(0, 5),
    };
  }

  private filterTransactions(user: AuthUser, query: TransactionQuery) {
    const from = this.parseDate(query.from, 'from');
    const to = this.parseDate(query.to, 'to', true);
    return this.database.transactions.filter(
      (item) =>
        item.storeId === user.storeId &&
        (!query.productId || item.productId === query.productId) &&
        (!query.type || item.type === query.type) &&
        (!from || item.createdAt >= from) &&
        (!to || item.createdAt <= to),
    );
  }

  private parseDate(value: string | undefined, field: string, endOfDay = false): string | undefined {
    if (!value) return undefined;
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) && endOfDay ? `${value}T23:59:59.999` : value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${field} không phải ngày hợp lệ`);
    return date.toISOString();
  }
}
