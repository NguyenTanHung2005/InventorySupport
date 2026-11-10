import { Permission, UserRole } from '../types';

/**
 * Bản sao ma trận quyền của backend (Server/backend/src/common/permissions.ts),
 * chỉ dùng để ẩn/hiện giao diện. Backend vẫn là nơi kiểm tra quyền thật sự.
 */
const ALL: Permission[] = [
  'PRODUCT_VIEW',
  'PRODUCT_CREATE',
  'PRODUCT_UPDATE',
  'PRODUCT_DELETE',
  'STOCK_IMPORT',
  'STOCK_EXPORT',
  'STOCK_ADJUST',
  'REPORT_VIEW',
  'USER_MANAGE',
  'AI_USE',
];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: ALL,
  MANAGER: ALL.filter((permission) => permission !== 'USER_MANAGE'),
  STAFF: ['PRODUCT_VIEW', 'STOCK_EXPORT', 'AI_USE'],
  VIEWER: ['PRODUCT_VIEW', 'REPORT_VIEW'],
};

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Quản trị viên',
  MANAGER: 'Quản lý',
  STAFF: 'Nhân viên',
  VIEWER: 'Chỉ xem',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  ADMIN: 'Toàn quyền, quản lý tài khoản nhân viên',
  MANAGER: 'Tạo, sửa, xóa sản phẩm; nhập, xuất, kiểm kê kho',
  STAFF: 'Xem sản phẩm và xuất kho',
  VIEWER: 'Chỉ xem sản phẩm và báo cáo',
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  PRODUCT_VIEW: 'Xem sản phẩm',
  PRODUCT_CREATE: 'Tạo sản phẩm',
  PRODUCT_UPDATE: 'Sửa sản phẩm',
  PRODUCT_DELETE: 'Xóa sản phẩm',
  STOCK_IMPORT: 'Nhập kho',
  STOCK_EXPORT: 'Xuất kho',
  STOCK_ADJUST: 'Kiểm kê',
  REPORT_VIEW: 'Xem báo cáo',
  USER_MANAGE: 'Quản lý tài khoản',
  AI_USE: 'Dùng AI / quét ảnh',
};

export const STOCK_TYPE_PERMISSION = {
  IMPORT: 'STOCK_IMPORT',
  EXPORT: 'STOCK_EXPORT',
  ADJUSTMENT: 'STOCK_ADJUST',
} as const satisfies Record<string, Permission>;

export const STOCK_TYPE_LABELS = {
  IMPORT: 'Nhập kho',
  EXPORT: 'Xuất kho',
  ADJUSTMENT: 'Kiểm kê',
} as const;

export function roleCan(role: UserRole | undefined, permission: Permission): boolean {
  return role ? ROLE_PERMISSIONS[role].includes(permission) : false;
}
