import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  AppNotification,
  Product,
  StockTransaction,
  StoredUser,
  UserRole,
} from '../common/types.js';
import { hashPassword } from '../common/password.js';

interface DatabaseSnapshot {
  users: StoredUser[];
  products: Product[];
  transactions: StockTransaction[];
  notifications: AppNotification[];
}

/**
 * Kho dữ liệu đơn giản lưu ra file JSON (mặc định `data/db.json`).
 * Đặt `DATA_FILE=memory` (hoặc chạy test) để chỉ giữ trong RAM.
 * Các service gọi `save()` sau mỗi thao tác ghi. Khi chuyển sang
 * PostgreSQL chỉ cần thay lớp này, API giữ nguyên.
 */
@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  private readonly file?: string;

  users: StoredUser[] = [];
  products: Product[] = [];
  transactions: StockTransaction[] = [];
  notifications: AppNotification[] = [];

  constructor() {
    const configured = process.env.DATA_FILE;
    const inMemory = configured === 'memory' || process.env.VITEST !== undefined;
    this.file = inMemory ? undefined : resolve(configured ?? 'data/db.json');

    if (this.file && existsSync(this.file)) {
      this.load(this.file);
    } else {
      this.seed();
      this.save();
    }
  }

  createId(prefix: string): string {
    return `${prefix}-${randomUUID()}`;
  }

  save(): void {
    if (!this.file) return;
    const snapshot: DatabaseSnapshot = {
      users: this.users,
      products: this.products,
      transactions: this.transactions,
      notifications: this.notifications,
    };
    mkdirSync(dirname(this.file), { recursive: true });
    // Ghi ra file tạm rồi đổi tên để không làm hỏng dữ liệu nếu tiến trình bị ngắt giữa chừng.
    const temp = `${this.file}.tmp`;
    writeFileSync(temp, JSON.stringify(snapshot, null, 2), 'utf8');
    renameSync(temp, this.file);
  }

  private load(file: string): void {
    try {
      const snapshot = JSON.parse(readFileSync(file, 'utf8')) as Partial<DatabaseSnapshot>;
      this.users = snapshot.users ?? [];
      this.products = snapshot.products ?? [];
      this.transactions = snapshot.transactions ?? [];
      this.notifications = snapshot.notifications ?? [];
      this.logger.log(`Đã nạp dữ liệu từ ${file}`);
    } catch (error) {
      this.logger.error(`Không đọc được ${file}, khởi tạo dữ liệu mẫu`, error as Error);
      this.seed();
    }
  }

  private seed(): void {
    const now = new Date().toISOString();
    const demoPassword = hashPassword('demo123');
    const user = (id: string, name: string, email: string, role: UserRole): StoredUser => ({
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
      user('user-admin-1', 'Quản trị viên', 'admin@example.com', UserRole.ADMIN),
      user('user-manager-1', 'Quản lý kho', 'manager@example.com', UserRole.MANAGER),
      user('user-staff-1', 'Nhân viên bán hàng', 'staff@example.com', UserRole.STAFF),
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
      product('product-1', '8934588012345', 'Coca-Cola 390ml', 'Nước giải khát', 'chai', 10000, 7500, 24, 10, 'Nước ngọt có ga chai 390ml'),
      product('product-2', '8934563138165', 'Mì Hảo Hảo tôm chua cay', 'Thực phẩm khô', 'gói', 4500, 3600, 6, 20, 'Mì ăn liền gói 75g'),
      product('product-3', '8936036020375', 'Sữa tươi Vinamilk 180ml', 'Sữa', 'hộp', 8000, 6500, 0, 12, 'Sữa tươi tiệt trùng có đường'),
    ];
    this.transactions = [];
    this.notifications = [];
  }
}
