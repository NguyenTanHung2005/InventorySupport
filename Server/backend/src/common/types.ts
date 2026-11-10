export enum UserRole {
  /** Quản trị viên: toàn quyền, quản lý tài khoản nhân viên. */
  ADMIN = 'ADMIN',
  /** Quản lý: tạo, sửa, xóa sản phẩm; nhập, xuất, kiểm kê kho. */
  MANAGER = 'MANAGER',
  /** Nhân viên: chỉ được xuất kho. */
  STAFF = 'STAFF',
  /** Chỉ xem. */
  VIEWER = 'VIEWER',
}

export enum StockTransactionType {
  IMPORT = 'IMPORT',
  EXPORT = 'EXPORT',
  /** Kiểm kê: đặt lại tồn kho bằng số đếm thực tế. */
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum NotificationType {
  LOW_STOCK = 'LOW_STOCK',
  OUT_OF_STOCK = 'OUT_OF_STOCK',
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  storeId: string;
}

export interface StoredUser extends AuthUser {
  passwordHash: string;
  active: boolean;
  pushTokens: string[];
  createdAt: string;
  updatedAt: string;
}

/** Thông tin tài khoản trả về cho client (không có passwordHash). */
export type PublicUser = Omit<StoredUser, 'passwordHash' | 'pushTokens'>;

export interface Product {
  id: string;
  storeId: string;
  barcode: string;
  name: string;
  normalizedName: string;
  description: string;
  category: string;
  unit: string;
  /** Giá bán (VND). */
  price: number;
  /** Giá nhập (VND). */
  costPrice: number;
  supplier: string;
  minStock: number;
  /** Đường dẫn tương đối, ví dụ `/uploads/store-1/abc.jpg`. */
  imageUrl?: string;
  quantity: number;
  createdAt: string;
  updatedAt: string;
  /** Xóa mềm để giữ lại lịch sử nhập/xuất. */
  deletedAt?: string;
}

export interface StockTransaction {
  id: string;
  storeId: string;
  productId: string;
  productName: string;
  type: StockTransactionType;
  /** Số lượng thay đổi (luôn dương với IMPORT/EXPORT, có thể âm với ADJUSTMENT). */
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  reason?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  storeId: string;
  type: NotificationType;
  productId: string;
  title: string;
  message: string;
  readBy: string[];
  createdAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
