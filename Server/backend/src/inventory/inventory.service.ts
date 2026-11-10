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
import { StockMovementDto, TransactionQuery } from './dto/stock-movement.dto.js';

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
    const type = requiredEnum(dto.type, Object.values(StockTransactionType), 'Loại giao dịch');
    if (!hasPermission(user.role, PERMISSION_BY_TYPE[type])) {
      throw new ForbiddenException(
        type === StockTransactionType.IMPORT
          ? 'Bạn không có quyền nhập kho'
          : type === StockTransactionType.EXPORT
            ? 'Bạn không có quyền xuất kho'
            : 'Bạn không có quyền kiểm kê',
      );
    }
    const product = this.products.findById(requiredString(dto.productId, 'Sản phẩm'), user);
    const isAdjustment = type === StockTransactionType.ADJUSTMENT;
    const quantity = requiredNumber(dto.quantity, 'Số lượng', { min: isAdjustment ? 0 : 1, integer: true });
    const reason = optionalString(dto.reason, 'Ghi chú', 300);
    if (isAdjustment && !reason) throw new BadRequestException('Kiểm kê cần ghi rõ lý do chênh lệch');
    if (type === StockTransactionType.EXPORT && product.quantity < quantity) {
      throw new BadRequestException(`Số lượng xuất vượt quá tồn kho (còn ${product.quantity} ${product.unit})`);
    }

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
    this.database.save();
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
