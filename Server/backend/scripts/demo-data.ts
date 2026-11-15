import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { hashPassword } from '../src/common/password.js';
import {
  AppNotification,
  Product,
  StockTransaction,
  StoredUser,
  UserRole,
  StockTransactionType,
  NotificationType,
} from '../src/common/types.js';
import { hasPermission, Permission } from '../src/common/permissions.js';
export interface DemoData {
  users: StoredUser[];
  products: Product[];
  transactions: StockTransaction[];
  notifications: AppNotification[];
}
export const fixtureRoot = () => resolve('fixtures/mini-mart');
export function buildDemo(endDay = yesterday()): DemoData {
  assert(
    /^\d{4}-\d{2}-\d{2}$/.test(endDay) &&
      new Date(`${endDay}T00:00:00Z`).toISOString().startsWith(endDay),
    'Ngày kết thúc phải là YYYY-MM-DD hợp lệ',
  );
  const end = Date.parse(`${endDay}T00:00:00+07:00`);
  const start = end - 29 * 86400000;
  const at = (day: number, minute: number) =>
    new Date(start + day * 86400000 + minute * 60000).toISOString();
  const roles = [
    UserRole.ADMIN,
    UserRole.MANAGER,
    UserRole.STAFF,
    UserRole.STAFF,
    UserRole.STAFF,
    UserRole.VIEWER,
  ];
  const names = ['admin', 'manager', 'staff1', 'staff2', 'staff3', 'viewer'];
  const users = roles.map((role, i): StoredUser => ({
    id: `user-demo-${names[i]}`,
    storeId: 'store-1',
    name: [
      'Chủ cửa hàng',
      'Quản lý kho',
      'Thu ngân sáng',
      'Thu ngân chiều',
      'Nhân viên bán hàng',
      'Người xem báo cáo',
    ][i],
    email: `${names[i]}@minimart.example`,
    role,
    active: true,
    passwordHash: hashPassword('MiniMart123!'),
    pushTokens: [],
    createdAt: at(0, 420),
    updatedAt: at(0, 420),
  }));
  const catalog = JSON.parse(
    readFileSync(resolve(fixtureRoot(), 'catalog.json'), 'utf8').replace(
      /^\uFEFF/,
      '',
    ),
  ) as Omit<Product, 'storeId' | 'quantity' | 'createdAt' | 'updatedAt'>[];
  const data: DemoData = {
    users,
    products: catalog.map((row) => ({
      ...row,
      storeId: 'store-1',
      quantity: 0,
      createdAt: at(0, 450),
      updatedAt: at(0, 450),
    })),
    transactions: [],
    notifications: [],
  };
  function move(
    product: Product,
    type: StockTransactionType,
    amount: number,
    time: string,
    user: StoredUser,
    reason: string,
  ) {
    const before = product.quantity;
    const after =
      type === StockTransactionType.ADJUSTMENT
        ? amount
        : before + (type === StockTransactionType.EXPORT ? -amount : amount);
    assert(after >= 0);
    product.quantity = after;
    product.updatedAt = time;
    data.transactions.push({
      id: `transaction-demo-${String(data.transactions.length + 1).padStart(5, '0')}`,
      storeId: 'store-1',
      productId: product.id,
      productName: product.name,
      type,
      quantity:
        type === StockTransactionType.ADJUSTMENT ? after - before : amount,
      quantityBefore: before,
      quantityAfter: after,
      reason,
      createdBy: user.id,
      createdByName: user.name,
      createdAt: time,
    });
    if (
      (before > 0 && after === 0) ||
      (before > product.minStock && after <= product.minStock)
    ) {
      const empty = after === 0;
      data.notifications.push({
        id: `notification-demo-${data.notifications.length + 1}`,
        storeId: 'store-1',
        type: empty
          ? NotificationType.OUT_OF_STOCK
          : NotificationType.LOW_STOCK,
        productId: product.id,
        title: empty ? 'Hết hàng' : 'Sắp hết hàng',
        message: `${product.name} còn ${after} ${product.unit}.`,
        readBy: data.notifications.length % 2 ? [users[1].id] : [],
        createdAt: time,
      });
    }
  }
  data.products.forEach((product, i) =>
    move(
      product,
      StockTransactionType.IMPORT,
      35 + (i % 6) * 5,
      at(0, 480 + i),
      users[1],
      'Nhập tồn đầu kỳ mô phỏng',
    ),
  );
  for (let day = 0; day < 30; day++) {
    for (let sale = 0; sale < 18; sale++) {
      const index = (day * 11 + sale * 7) % 60,
        product = data.products[index];
      const amount = 1 + ((day + sale) % 5);
      if (product.quantity < amount + 8)
        move(
          product,
          StockTransactionType.IMPORT,
          24,
          at(day, 600 + sale * 15),
          users[1],
          'Nhập bổ sung định kỳ',
        );
      move(
        product,
        StockTransactionType.EXPORT,
        amount,
        at(day, 601 + sale * 15),
        users[2 + (sale % 3)],
        'Bán lẻ mô phỏng',
      );
    }
    if (day % 7 === 6)
      move(
        data.products[day],
        StockTransactionType.ADJUSTMENT,
        Math.max(0, data.products[day].quantity - 1),
        at(day, 1000),
        users[1],
        'Kiểm đếm cuối tuần: lệch một đơn vị',
      );
  }
  data.products.forEach((product, i) => {
    const target =
      i < 3 ? 0 : i < 8 ? 3 + (i % 5) : Math.max(15, product.quantity);
    if (target !== product.quantity)
      move(
        product,
        StockTransactionType.ADJUSTMENT,
        target,
        at(29, 1080 + i),
        users[0],
        'Kiểm đếm cuối kỳ mô phỏng',
      );
  });
  checkDemo(data);
  return data;
}
export function yesterday(): string {
  return new Date(Date.now() + 7 * 3600000 - 86400000)
    .toISOString()
    .slice(0, 10);
}
export function checkDemo(data: DemoData) {
  assert(data.users.length > 0 && data.products.length > 0);
  for (const rows of Object.values(data))
    assert(
      new Set(rows.map((row: { id: string }) => row.id)).size === rows.length,
      'ID trùng',
    );
  assert(
    new Set(data.users.map((user) => user.email)).size === data.users.length,
    'Email trùng',
  );
  assert(
    new Set(
      data.products.map((product) => `${product.storeId}:${product.barcode}`),
    ).size === data.products.length,
    'Barcode trùng',
  );
  const quantities = new Map(data.products.map((product) => [product.id, 0]));
  const byId = new Map(data.products.map((product) => [product.id, product]));
  const users = new Map(data.users.map((user) => [user.id, user]));
  const permission = {
    IMPORT: Permission.STOCK_IMPORT,
    EXPORT: Permission.STOCK_EXPORT,
    ADJUSTMENT: Permission.STOCK_ADJUST,
  };
  for (const row of [...data.transactions].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )) {
    const product = byId.get(row.productId),
      user = users.get(row.createdBy);
    assert(
      product &&
        user &&
        product.storeId === row.storeId &&
        user.storeId === row.storeId,
      'Tham chiếu/cửa hàng sai',
    );
    assert(
      hasPermission(user.role, permission[row.type]),
      'Người tạo sai quyền',
    );
    assert.equal(
      quantities.get(row.productId),
      row.quantityBefore,
      'Chuỗi tồn không khớp',
    );
    assert(
      Number.isSafeInteger(row.quantity) &&
        Number.isSafeInteger(row.quantityAfter) &&
        row.quantityAfter >= 0,
    );
    assert.equal(
      row.quantityAfter,
      row.quantityBefore +
        (row.type === StockTransactionType.EXPORT
          ? -row.quantity
          : row.quantity),
    );
    if (row.type !== StockTransactionType.ADJUSTMENT) assert(row.quantity > 0);
    else assert(row.reason?.trim());
    assert(!Number.isNaN(Date.parse(row.createdAt)));
    quantities.set(row.productId, row.quantityAfter);
  }
  for (const product of data.products)
    assert.equal(
      product.quantity,
      quantities.get(product.id),
      'Tồn cuối không khớp',
    );
  for (const row of data.notifications) {
    assert.equal(byId.get(row.productId)?.storeId, row.storeId);
    for (const id of row.readBy)
      assert.equal(users.get(id)?.storeId, row.storeId);
  }
  return {
    users: data.users.length,
    products: data.products.length,
    transactions: data.transactions.length,
    notifications: data.notifications.length,
  };
}
