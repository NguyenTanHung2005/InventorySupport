import { ConflictException } from '@nestjs/common';
import {
  DatabaseService,
  type Tables,
  type Table,
  type Filter,
} from '../../src/database/database.service.js';
import {
  AppNotification,
  Product,
  StockTransaction,
  StoredUser,
  UserRole,
} from '../../src/common/types.js';
import { hashPassword } from '../../src/common/password.js';

function matches(row: Record<string, unknown>, filter: Filter): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    const value = row[key === '_id' ? 'id' : key];
    if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
      const condition = expected as Record<string, unknown>;
      if ('$exists' in condition)
        return (value !== undefined) === condition.$exists;
      if ('$ne' in condition) return value !== condition.$ne;
      if ('$in' in condition)
        return (condition.$in as unknown[]).includes(value);
    }
    return Array.isArray(value) ? value.includes(expected) : value === expected;
  });
}

/** Test-only fixture; transaction rollback here is not Mongo integration evidence. */
export class MemoryDatabase extends DatabaseService {
  override async onModuleInit(): Promise<void> {}
  users: StoredUser[] = [];
  products: Product[] = [];
  transactions: StockTransaction[] = [];
  notifications: AppNotification[] = [];
  constructor() {
    super(
      undefined as unknown as ConstructorParameters<typeof DatabaseService>[0],
    );
    this.seed();
  }
  override async find<K extends Table>(
    table: K,
    filter: Filter = {},
  ): Promise<Tables[K][]> {
    return structuredClone(
      (this[table] as Tables[K][]).filter((row) =>
        matches(row as unknown as Record<string, unknown>, filter),
      ),
    );
  }
  override async get<K extends Table>(
    table: K,
    filter: Filter,
  ): Promise<Tables[K] | undefined> {
    return (await this.find(table, filter))[0];
  }
  override async insert<K extends Table>(
    table: K,
    row: Tables[K],
  ): Promise<Tables[K]> {
    if (this[table].some((value) => value.id === row.id))
      throw new ConflictException('Trùng ID');
    if (
      table === 'users' &&
      this.users.some((value) => value.email === (row as StoredUser).email)
    )
      throw new ConflictException('Email đã được sử dụng');
    if (
      table === 'products' &&
      this.products.some(
        (value) =>
          value.storeId === row.storeId &&
          value.barcode === (row as Product).barcode,
      )
    )
      throw new ConflictException('Barcode đã tồn tại trong cửa hàng');
    (this[table] as Tables[K][]).push(structuredClone(row));
    return structuredClone(row);
  }
  override async update<K extends Table>(
    table: K,
    filter: Filter,
    update: Filter,
  ): Promise<Tables[K] | undefined> {
    const row = (this[table] as Tables[K][]).find((value) =>
      matches(value as unknown as Record<string, unknown>, filter),
    );
    if (!row) return undefined;
    const data = row as unknown as Record<string, unknown>;
    Object.assign(
      data,
      Object.fromEntries(
        Object.entries((update.$set ?? {}) as Filter).filter(
          ([, value]) => value !== undefined,
        ),
      ),
    );
    for (const key of Object.keys((update.$unset ?? {}) as Filter))
      delete data[key];
    for (const [key, value] of Object.entries((update.$inc ?? {}) as Filter))
      data[key] = Number(data[key] ?? 0) + Number(value);
    for (const [key, value] of Object.entries(
      (update.$addToSet ?? {}) as Filter,
    ))
      data[key] = [...new Set([...(data[key] as unknown[]), value])];
    for (const [key, value] of Object.entries((update.$pull ?? {}) as Filter))
      data[key] = (data[key] as unknown[]).filter((item) => item !== value);
    return structuredClone(row);
  }
  override async delete(table: Table, filter: Filter): Promise<void> {
    const rows = this[table];
    const index = rows.findIndex((row) =>
      matches(row as unknown as Record<string, unknown>, filter),
    );
    if (index >= 0) rows.splice(index, 1);
  }
  override async transaction<T>(
    work: (db: DatabaseService) => Promise<T>,
  ): Promise<T> {
    const snapshot = structuredClone({
      users: this.users,
      products: this.products,
      transactions: this.transactions,
      notifications: this.notifications,
    });
    try {
      return await work(this);
    } catch (error) {
      Object.assign(this, snapshot);
      throw error;
    }
  }
  private seed(): void {
    const now = new Date().toISOString();
    const demoPassword = hashPassword('demo123');
    const user = (
      id: string,
      name: string,
      email: string,
      role: UserRole,
    ): StoredUser => ({
      id,
      name,
      email,
      role,
      storeId: 'store-1',
      passwordHash: demoPassword,
      active: true,
      pushTokens: [],
      createdAt: now,
      updatedAt: now,
    });

    this.users = [
      user(
        'user-admin-1',
        'Quản trị viên',
        'admin@example.com',
        UserRole.ADMIN,
      ),
      user(
        'user-manager-1',
        'Quản lý kho',
        'manager@example.com',
        UserRole.MANAGER,
      ),
      user(
        'user-staff-1',
        'Nhân viên bán hàng',
        'staff@example.com',
        UserRole.STAFF,
      ),
    ];

    const product = (
      id: string,
      barcode: string,
      name: string,
      category: string,
      unit: string,
      price: number,
      costPrice: number,
      quantity: number,
      minStock: number,
      description: string,
    ): Product => ({
      id,
      storeId: 'store-1',
      barcode,
      name,
      normalizedName: name,
      description,
      category,
      unit,
      price,
      costPrice,
      supplier: '',
      minStock,
      quantity,
      createdAt: now,
      updatedAt: now,
    });

    this.products = [
      product(
        'product-1',
        '8934588012345',
        'Coca-Cola 390ml',
        'Nước giải khát',
        'chai',
        10000,
        7500,
        24,
        10,
        'Nước ngọt có ga chai 390ml',
      ),
      product(
        'product-2',
        '8934563138165',
        'Mì Hảo Hảo tôm chua cay',
        'Thực phẩm khô',
        'gói',
        4500,
        3600,
        6,
        20,
        'Mì ăn liền gói 75g',
      ),
      product(
        'product-3',
        '8936036020375',
        'Sữa tươi Vinamilk 180ml',
        'Sữa',
        'hộp',
        8000,
        6500,
        0,
        12,
        'Sữa tươi tiệt trùng có đường',
      ),
    ];
    this.transactions = [];
    this.notifications = [];
  }
}
