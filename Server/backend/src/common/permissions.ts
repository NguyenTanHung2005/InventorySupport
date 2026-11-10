import { UserRole } from './types.js';

/**
 * Ma trận phân quyền duy nhất của hệ thống. Mobile giữ một bản sao để ẩn/hiện
 * nút bấm, nhưng backend luôn là lớp kiểm tra cuối cùng.
 */
export enum Permission {
  PRODUCT_VIEW = 'PRODUCT_VIEW',
  PRODUCT_CREATE = 'PRODUCT_CREATE',
  PRODUCT_UPDATE = 'PRODUCT_UPDATE',
  PRODUCT_DELETE = 'PRODUCT_DELETE',
  STOCK_IMPORT = 'STOCK_IMPORT',
  STOCK_EXPORT = 'STOCK_EXPORT',
  STOCK_ADJUST = 'STOCK_ADJUST',
  REPORT_VIEW = 'REPORT_VIEW',
  USER_MANAGE = 'USER_MANAGE',
  AI_USE = 'AI_USE',
}

const ALL = Object.values(Permission);

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  [UserRole.ADMIN]: ALL,
  [UserRole.MANAGER]: [
    Permission.PRODUCT_VIEW,
    Permission.PRODUCT_CREATE,
    Permission.PRODUCT_UPDATE,
    Permission.PRODUCT_DELETE,
    Permission.STOCK_IMPORT,
    Permission.STOCK_EXPORT,
    Permission.STOCK_ADJUST,
    Permission.REPORT_VIEW,
    Permission.AI_USE,
  ],
  [UserRole.STAFF]: [
    Permission.PRODUCT_VIEW,
    Permission.STOCK_EXPORT,
    Permission.AI_USE,
  ],
  [UserRole.VIEWER]: [Permission.PRODUCT_VIEW, Permission.REPORT_VIEW],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
