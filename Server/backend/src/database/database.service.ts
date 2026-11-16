import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { ClientSession, Connection } from 'mongoose';
import type {
  AppNotification,
  Product,
  StockTransaction,
  StoredUser,
} from '../common/types.js';

import type { StocktakeSession, StocktakeItem } from '../common/types.js';

export interface Tables {
  stocktake_sessions: StocktakeSession;
  stocktake_items: StocktakeItem;
  users: StoredUser;
  products: Product;
  transactions: StockTransaction;
  notifications: AppNotification;
}
export type Table = keyof Tables;
export type Filter = Record<string, unknown>;

export function mongoUri(value: string | undefined): string {
  if (!value || !/^mongodb(?:\+srv)?:\/\//.test(value))
    throw new Error('Cần cấu hình MONGODB_URI hợp lệ trên backend');
  return value;
}

export function fromDocument<T>(document: Record<string, unknown>): T {
  const { _id, __v: _version, adminRevision: _revision, ...fields } = document;
  return { ...fields, id: String(_id) } as T;
}

@Injectable()
export class DatabaseService {
  private session?: ClientSession;
  constructor(
    @Inject('MONGO_CONNECTION') private readonly connection: Connection,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const table of [
      'stocktake_sessions',
      'stocktake_items',
      'users',
      'products',
      'transactions',
      'notifications',
    ]) {
      await this.connection.model(table).init();
    }
  }
  createId(prefix: string): string {
    return `${prefix}-${randomUUID()}`;
  }

  async find<K extends Table>(
    table: K,
    filter: Filter = {},
  ): Promise<Tables[K][]> {
    const rows = await this.connection
      .model(table)
      .find(filter)
      .session(this.session ?? null)
      .lean<Record<string, unknown>[]>()
      .exec();
    return rows.map((row: Record<string, unknown>) =>
      fromDocument<Tables[K]>(row),
    );
  }
  async get<K extends Table>(
    table: K,
    filter: Filter,
  ): Promise<Tables[K] | undefined> {
    const row = await this.connection
      .model(table)
      .findOne(filter)
      .session(this.session ?? null)
      .lean<Record<string, unknown> | null>()
      .exec();
    return row ? fromDocument<Tables[K]>(row) : undefined;
  }
  async insert<K extends Table>(
    table: K,
    value: Tables[K],
  ): Promise<Tables[K]> {
    const { id, ...fields } = value;
    try {
      await this.connection
        .model(table)
        .create([{ ...fields, _id: id }], { session: this.session });
      return value;
    } catch (error) {
      return this.writeError(error, table);
    }
  }
  async update<K extends Table>(
    table: K,
    filter: Filter,
    update: Filter,
  ): Promise<Tables[K] | undefined> {
    try {
      const row = await this.connection
        .model(table)
        .findOneAndUpdate(filter, update, {
          session: this.session,
          returnDocument: 'after',
          runValidators: true,
        })
        .lean<Record<string, unknown> | null>()
        .exec();
      return row ? fromDocument<Tables[K]>(row) : undefined;
    } catch (error) {
      return this.writeError(error, table);
    }
  }
  async delete(table: Table, filter: Filter): Promise<void> {
    await this.connection
      .model(table)
      .deleteOne(filter)
      .session(this.session ?? null)
      .exec();
  }
  async transaction<T>(work: (db: DatabaseService) => Promise<T>): Promise<T> {
    return this.connection.transaction(async (session: ClientSession) => {
      const scoped = new DatabaseService(this.connection);
      scoped.session = session;
      return work(scoped);
    });
  }
  private writeError(error: unknown, table: Table): never {
    if (
      (error as { code?: number; keyPattern?: { pushTokens?: number } })
        ?.code === 11000 &&
      (error as { keyPattern?: { pushTokens?: number } }).keyPattern?.pushTokens
    ) {
      throw new ConflictException(
        'Thiết bị đang được đăng ký bởi tài khoản khác. Hãy thử lại.',
      );
    }
    if ((error as { code?: number })?.code === 11000) {
      throw new ConflictException(
        table === 'users'
          ? 'Email đã được sử dụng'
          : 'Barcode đã tồn tại trong cửa hàng',
      );
    }
    throw error;
  }
}
