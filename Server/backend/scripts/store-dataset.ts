import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { hasPermission, Permission } from '../src/common/permissions.js';
import {
  NotificationType,
  StockTransactionType,
  type AppNotification,
  type AuthUser,
  type Product,
  type StockTransaction,
} from '../src/common/types.js';

export type CatalogProduct = Pick<
  Product,
  | 'barcode'
  | 'name'
  | 'description'
  | 'category'
  | 'unit'
  | 'price'
  | 'costPrice'
  | 'supplier'
  | 'minStock'
>;
export type DatasetActor = AuthUser & { active?: boolean };
export interface StoreDataset {
  startDay: string;
  endDay: string;
  products: Product[];
  transactions: StockTransaction[];
  notifications: AppNotification[];
}
const DAY = 86400000;
export function buildStoreDataset(
  catalog: CatalogProduct[],
  users: DatasetActor[],
  endDay: string,
): StoreDataset {
  assert(/^\d{4}-\d{2}-\d{2}$/.test(endDay));
  assert(new Date(`${endDay}T00:00:00Z`).toISOString().startsWith(endDay));
  assert(
    catalog.length > 0 &&
      new Set(catalog.map((p) => p.barcode)).size === catalog.length,
  );
  assert(
    users.length > 0 && new Set(users.map((u) => u.storeId)).size === 1,
    'Expected one store',
  );
  const storeId = users[0].storeId;
  const active = users.filter((u) => u.active !== false);
  const manager = active.find(
    (u) =>
      hasPermission(u.role, Permission.STOCK_IMPORT) &&
      hasPermission(u.role, Permission.STOCK_ADJUST),
  );
  const sellers = active.filter((u) =>
    hasPermission(u.role, Permission.STOCK_EXPORT),
  );
  assert(
    manager && sellers.length,
    'Store needs an active inventory manager and seller',
  );
  const start = Date.parse(`${endDay}T00:00:00+07:00`) - 59 * DAY;
  const at = (day: number, minute: number) =>
    new Date(start + day * DAY + minute * 60000).toISOString();
  const data: StoreDataset = {
    startDay: new Date(start + 7 * 3600000).toISOString().slice(0, 10),
    endDay,
    products: catalog.map((p) => ({
      ...p,
      normalizedName: p.name,
      id:
        'product-retail-' +
        createHash('sha256').update(p.barcode).digest('hex').slice(0, 16),
      storeId,
      quantity: 0,
      stockVersion: 0,
      createdAt: at(0, 420),
      updatedAt: at(0, 420),
    })),
    transactions: [],
    notifications: [],
  };
  function move(
    product: Product,
    type: StockTransactionType,
    amount: number,
    time: string,
    user: DatasetActor,
    reason: string,
  ) {
    const before = product.quantity;
    const after =
      type === StockTransactionType.ADJUSTMENT
        ? amount
        : before + (type === StockTransactionType.EXPORT ? -amount : amount);
    assert(Number.isSafeInteger(after) && after >= 0);
    if (type === StockTransactionType.ADJUSTMENT && after === before) return;
    product.quantity = after;
    product.stockVersion = (product.stockVersion ?? 0) + 1;
    product.updatedAt = time;
    data.transactions.push({
      id: `transaction-retail-${String(data.transactions.length + 1).padStart(6, '0')}`,
      storeId,
      productId: product.id,
      productName: product.name,
      type,
      quantity:
        type === StockTransactionType.ADJUSTMENT ? after - before : amount,
      quantityBefore: before,
      quantityAfter: after,
      reason: `[MÔ PHỎNG] ${reason}`,
      createdBy: user.id,
      createdByName: user.name,
      createdAt: time,
    });
    const empty = before > 0 && after === 0;
    if (empty || (before > product.minStock && after <= product.minStock))
      data.notifications.push({
        id: `notification-retail-${String(data.notifications.length + 1).padStart(5, '0')}`,
        storeId,
        productId: product.id,
        type: empty
          ? NotificationType.OUT_OF_STOCK
          : NotificationType.LOW_STOCK,
        title: empty ? 'Hết hàng' : 'Sắp hết hàng',
        message: `[MÔ PHỎNG] ${product.name} còn ${after} ${product.unit}.`,
        readBy: data.notifications.length % 3 === 0 ? [manager!.id] : [],
        createdAt: time,
      });
  }
  data.products.forEach((p, i) =>
    move(
      p,
      StockTransactionType.IMPORT,
      30 + (i % 7) * 4,
      at(0, 480 + i),
      manager,
      'Nhập tồn đầu kỳ',
    ),
  );
  for (let day = 0; day < 60; day++) {
    for (let sale = 0; sale < 24; sale++) {
      const p = data.products[(day * 13 + sale * 7) % data.products.length],
        amount = 1 + ((day + sale) % 4),
        time = 600 + sale * 15;
      if (p.quantity < amount)
        move(
          p,
          StockTransactionType.IMPORT,
          24 + (day % 3) * 6,
          at(day, time),
          manager,
          'Nhập bổ sung',
        );
      move(
        p,
        StockTransactionType.EXPORT,
        amount,
        at(day, time + 1),
        sellers[(day + sale) % sellers.length],
        'Bán hàng',
      );
    }
    if (day % 7 === 6) {
      const p = data.products[(day * 3) % data.products.length];
      move(
        p,
        StockTransactionType.ADJUSTMENT,
        Math.max(0, p.quantity - 1),
        at(day, 1080),
        manager,
        'Đối chiếu tồn cuối tuần',
      );
    }
  }
  const group = Math.min(5, Math.floor(data.products.length / 3));
  for (let i = 0; i < group * 2; i++) {
    const p = data.products[i];
    move(
      p,
      StockTransactionType.ADJUSTMENT,
      i < group ? 0 : Math.max(1, p.minStock - 1),
      at(59, 1200 + i),
      manager,
      'Đối chiếu tồn cuối kỳ',
    );
  }
  data.transactions.sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  data.notifications.sort(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  validateStoreDataset(data, users);
  return data;
}

export function validateStoreDataset(
  data: StoreDataset,
  users: DatasetActor[],
) {
  const usersById = new Map(users.map((u) => [u.id, u])),
    products = new Map(data.products.map((p) => [p.id, p]));
  assert(products.size === data.products.length);
  const quantities = new Map<string, number>(),
    versions = new Map<string, number>();
  const permissions = {
    IMPORT: Permission.STOCK_IMPORT,
    EXPORT: Permission.STOCK_EXPORT,
    ADJUSTMENT: Permission.STOCK_ADJUST,
  };
  const ids = new Set<string>();
  let last = '';
  for (const tx of data.transactions) {
    assert(!ids.has(tx.id));
    ids.add(tx.id);
    assert(tx.createdAt >= last);
    last = tx.createdAt;
    const p = products.get(tx.productId),
      user = usersById.get(tx.createdBy);
    assert(p && user);
    assert(
      tx.storeId === p.storeId &&
        user.storeId === p.storeId &&
        hasPermission(user.role, permissions[tx.type]),
    );
    assert(tx.quantityBefore === (quantities.get(p.id) ?? 0));
    assert(
      Number.isSafeInteger(tx.quantity) &&
        Number.isSafeInteger(tx.quantityAfter) &&
        tx.quantityAfter >= 0,
    );
    assert(
      tx.quantityAfter ===
        tx.quantityBefore +
          (tx.type === StockTransactionType.EXPORT
            ? -tx.quantity
            : tx.quantity),
    );
    if (tx.type !== StockTransactionType.ADJUSTMENT) assert(tx.quantity > 0);
    assert(tx.createdAt >= p.createdAt && tx.reason?.startsWith('[MÔ PHỎNG]'));
    quantities.set(p.id, tx.quantityAfter);
    versions.set(p.id, (versions.get(p.id) ?? 0) + 1);
  }
  for (const p of data.products) {
    assert(p.quantity === (quantities.get(p.id) ?? 0));
    assert(p.stockVersion === (versions.get(p.id) ?? 0));
    assert(
      p.price >= 0 &&
        p.costPrice >= 0 &&
        Number.isSafeInteger(p.minStock) &&
        p.minStock >= 0,
    );
  }
  const noticeIds = new Set<string>();
  for (const n of data.notifications) {
    assert(!noticeIds.has(n.id));
    noticeIds.add(n.id);
    const p = products.get(n.productId);
    assert(p && n.storeId === p.storeId);
    assert(n.readBy.every((id) => usersById.get(id)?.storeId === p.storeId));
  }
}
