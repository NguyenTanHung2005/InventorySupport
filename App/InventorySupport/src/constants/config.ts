export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(/\/$/, '');

/** Tài khoản demo do backend tạo sẵn (mật khẩu chung: demo123). */
export const DEMO_ACCOUNTS = [
  { label: 'Admin', email: 'admin@example.com' },
  { label: 'Quản lý', email: 'manager@example.com' },
  { label: 'Nhân viên', email: 'staff@example.com' },
] as const;
export const DEMO_PASSWORD = 'demo123';

/** Chu kỳ kiểm tra thông báo mới (ms). */
export const NOTIFICATION_POLL_MS = 30_000;
export const PAGE_SIZE = 20;
