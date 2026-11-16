import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import {
  type AuthUser,
  type StocktakeSession,
  StockTransactionType,
} from '../common/types.js';
import { hasPermission, Permission } from '../common/permissions.js';
import {
  paginate,
  parsePageQuery,
  requiredString,
} from '../common/validation.js';
import { ProductsService } from '../products/products.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';

export interface StocktakeInput {
  countedQuantity?: unknown;
  baselineStockVersion?: unknown;
  expectedUnit?: unknown;
  expectedRevision?: unknown;
  reason?: unknown;
  raw?: unknown;
  productId?: unknown;
}
function count(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)
    throw new BadRequestException('Cần số nguyên không âm hợp lệ');
  return value;
}
@Injectable()
export class StocktakesService {
  constructor(
    private readonly database: DatabaseService,
    private readonly notifications: NotificationsService,
  ) {}

  private async session(id: string, user: AuthUser, db = this.database) {
    if (!hasPermission(user.role, Permission.STOCK_ADJUST))
      throw new ForbiddenException();
    const session = await db.get('stocktake_sessions', {
      _id: id,
      storeId: user.storeId,
      createdBy: user.id,
    });
    if (!session) throw new NotFoundException('Không tìm thấy phiên');
    return session;
  }
  private async lock(
    session: StocktakeSession,
    db: DatabaseService,
    revision = session.revision,
  ) {
    if (session.status !== 'IN_PROGRESS')
      throw new ConflictException('Phiên đã đóng');
    const updated = await db.update(
      'stocktake_sessions',
      { _id: session.id, revision: count(revision), status: 'IN_PROGRESS' },
      { $inc: { revision: 1 }, $set: { updatedAt: new Date().toISOString() } },
    );
    if (!updated) throw new ConflictException('Phiên đã thay đổi, hãy tải lại');
    return updated;
  }
  async create(user: AuthUser) {
    if (!hasPermission(user.role, Permission.STOCK_ADJUST))
      throw new ForbiddenException();
    const existing = await this.database.get('stocktake_sessions', {
      storeId: user.storeId,
      createdBy: user.id,
      status: 'IN_PROGRESS',
    });
    if (existing)
      throw new ConflictException({
        message: 'Đã có phiên đang mở',
        sessionId: existing.id,
      });
    const now = new Date().toISOString();
    return this.database.insert('stocktake_sessions', {
      id: this.database.createId('stocktake'),
      storeId: user.storeId,
      createdBy: user.id,
      createdByName: user.name,
      status: 'IN_PROGRESS',
      revision: 0,
      createdAt: now,
      updatedAt: now,
    });
  }
  async list(
    user: AuthUser,
    query: { page?: unknown; limit?: unknown; status?: string },
  ) {
    if (!hasPermission(user.role, Permission.STOCK_ADJUST))
      throw new ForbiddenException();
    const rows = await this.database.find('stocktake_sessions', {
      storeId: user.storeId,
      createdBy: user.id,
      ...(query.status ? { status: query.status } : {}),
    });
    return paginate(
      rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      parsePageQuery(query),
    );
  }
  async detail(id: string, user: AuthUser) {
    const session = await this.session(id, user);
    const items = await this.database.find('stocktake_items', {
      sessionId: id,
      storeId: user.storeId,
    });
    return {
      ...session,
      items,
      countedCount: items.length,
      adjustedCount: items.filter(
        (i) => i.countedQuantity !== i.baselineQuantity,
      ).length,
    };
  }
  async identify(id: string, input: StocktakeInput, user: AuthUser) {
    const session = await this.session(id, user);
    if (session.status !== 'IN_PROGRESS')
      throw new ConflictException('Phiên đã đóng');
    const products = new ProductsService(this.database);
    const product = input.productId
      ? await products.findById(
          requiredString(input.productId, 'Sản phẩm'),
          user,
        )
      : (await products.resolve(requiredString(input.raw, 'Mã', 2000), user))
          .product;
    if (!product) throw new NotFoundException('Mã chưa có trong kho');
    const item = await this.database.get('stocktake_items', {
      sessionId: id,
      productId: product.id,
    });
    return {
      product,
      baselineQuantity: product.quantity,
      baselineStockVersion: product.stockVersion ?? 0,
      item,
    };
  }
  async save(
    id: string,
    productId: string,
    input: StocktakeInput,
    user: AuthUser,
  ) {
    const quantity = count(input.countedQuantity),
      version = count(input.baselineStockVersion),
      revision = count(input.expectedRevision);
    const unit = requiredString(input.expectedUnit, 'Đơn vị');
    return this.database.transaction(async (db) => {
      const locked = await this.lock(await this.session(id, user, db), db);
      const product = await new ProductsService(db).findById(productId, user);
      if ((product.stockVersion ?? 0) !== version || product.unit !== unit)
        throw new ConflictException('Sản phẩm đã thay đổi, cần đếm lại');
      const item = await db.get('stocktake_items', {
        sessionId: id,
        productId,
      });
      if ((item?.revision ?? 0) !== revision)
        throw new ConflictException('Dòng đã thay đổi, hãy tải lại');
      if (
        !item &&
        (await db.find('stocktake_items', { sessionId: id })).length >= 200
      )
        throw new BadRequestException('Tối đa 200 sản phẩm');
      const now = new Date().toISOString();
      const values = {
        productName: product.name,
        barcode: product.barcode,
        unit,
        baselineQuantity: product.quantity,
        baselineStockVersion: version,
        countedQuantity: quantity,
        revision: locked.revision,
        countedBy: user.id,
        countedAt: now,
        updatedAt: now,
      };
      if (item)
        return db.update(
          'stocktake_items',
          { _id: item.id, revision },
          { $set: values },
        );
      return db.insert('stocktake_items', {
        id: db.createId('count'),
        storeId: user.storeId,
        sessionId: id,
        productId,
        createdAt: now,
        ...values,
      });
    });
  }
  async remove(
    id: string,
    productId: string,
    input: StocktakeInput,
    user: AuthUser,
  ) {
    return this.database.transaction(async (db) => {
      await this.lock(await this.session(id, user, db), db);
      const item = await db.get('stocktake_items', {
        sessionId: id,
        productId,
      });
      if (!item || item.revision !== count(input.expectedRevision))
        throw new ConflictException('Dòng đã thay đổi');
      await db.delete('stocktake_items', { _id: item.id });
      return { deleted: true };
    });
  }
  async cancel(id: string, input: StocktakeInput, user: AuthUser) {
    return this.database.transaction(async (db) => {
      await this.lock(
        await this.session(id, user, db),
        db,
        count(input.expectedRevision),
      );
      return db.update(
        'stocktake_sessions',
        { _id: id },
        {
          $set: { status: 'CANCELLED', cancelledAt: new Date().toISOString() },
        },
      );
    });
  }
  async complete(id: string, input: StocktakeInput, user: AuthUser) {
    const outcome = await this.database.transaction(async (db) => {
      const session = await this.session(id, user, db);
      if (session.status === 'COMPLETED')
        return { result: session.result!, alerts: [] };
      const reason = requiredString(input.reason, 'Lý do', 300);
      await this.lock(session, db, count(input.expectedRevision));
      const items = await db.find('stocktake_items', {
        sessionId: id,
        storeId: user.storeId,
      });
      if (!items.length) throw new BadRequestException('Chưa có dòng đã đếm');
      const products = new ProductsService(db),
        notifications = new NotificationsService(db);
      const inventory = new InventoryService(db, products, notifications);
      const conflicts: string[] = [];
      for (const item of items) {
        const product = await db.get('products', {
          _id: item.productId,
          storeId: user.storeId,
          deletedAt: { $exists: false },
        });
        if (
          !product ||
          product.unit !== item.unit ||
          (product.stockVersion ?? 0) !== item.baselineStockVersion
        )
          conflicts.push(item.productId);
      }
      if (conflicts.length)
        throw new ConflictException({
          message: 'Tồn hoặc đơn vị đã thay đổi. Cần đếm lại.',
          conflicts,
        });
      const transactionIds: string[] = [],
        alerts = [];
      for (const item of items) {
        // Write every counted product so concurrent movements invalidate this transaction.
        const product = await db.update(
          'products',
          {
            _id: item.productId,
            storeId: user.storeId,
            unit: item.unit,
            deletedAt: { $exists: false },
            ...(item.baselineStockVersion === 0
              ? {
                  $or: [
                    { stockVersion: 0 },
                    { stockVersion: { $exists: false } },
                  ],
                }
              : { stockVersion: item.baselineStockVersion }),
          },
          {
            $inc: { stockVersion: 1 },
            $set: { updatedAt: new Date().toISOString() },
          },
        );
        if (!product)
          throw new ConflictException({
            message: 'Cần đếm lại',
            conflicts: [item.productId],
          });
        if (product.quantity !== item.countedQuantity) {
          const movement = await inventory.apply(
            user,
            StockTransactionType.ADJUSTMENT,
            { product, quantity: count(item.countedQuantity) },
            reason,
            id,
          );
          transactionIds.push(movement.transaction.id);
          if (movement.alert) alerts.push(movement.alert);
        }
      }
      const completedAt = new Date().toISOString();
      const result = {
        countedCount: items.length,
        adjustedCount: transactionIds.length,
        transactionIds,
        completedAt,
      };
      await db.update(
        'stocktake_sessions',
        { _id: id },
        {
          $set: {
            status: 'COMPLETED',
            reason,
            completedAt,
            updatedAt: completedAt,
            result,
          },
        },
      );
      return { result, alerts };
    });
    for (const alert of outcome.alerts) void this.notifications.sendPush(alert);
    return outcome.result;
  }
}
