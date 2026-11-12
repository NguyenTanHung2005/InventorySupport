import { Platform } from 'react-native';
import Constants from 'expo-constants';

const API_PORT = process.env.EXPO_PUBLIC_API_PORT ?? '3000';

/**
 * Xác định địa chỉ backend:
 * 1. `EXPO_PUBLIC_API_URL` nếu được đặt (ưu tiên cao nhất, dùng khi deploy hoặc dùng tunnel).
 * 2. Web: cùng hostname với trang đang mở.
 * 3. Expo Go / development build: lấy IP của máy đang chạy Metro (`hostUri`, ví dụ 192.168.1.65:8081)
 *    vì backend thường chạy cùng máy đó.
 * 4. Android emulator: 10.0.2.2 là địa chỉ của máy tính host (localhost bên trong emulator là chính emulator).
 */
function resolveApiUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  const metroHost = hostUri?.split(':')[0];
  const isLoopback = !metroHost || metroHost === 'localhost' || metroHost === '127.0.0.1';
  // Bỏ qua tunnel (*.exp.direct) vì backend không đi qua tunnel của Expo.
  if (metroHost && !isLoopback && !metroHost.endsWith('.exp.direct')) {
    return `http://${metroHost}:${API_PORT}`;
  }

  return Platform.OS === 'android' ? `http://10.0.2.2:${API_PORT}` : `http://localhost:${API_PORT}`;
}

export const API_URL = resolveApiUrl();

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
