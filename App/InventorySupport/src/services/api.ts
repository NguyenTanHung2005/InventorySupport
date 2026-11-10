import { API_URL } from '../constants/config';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

type QueryValue = string | number | boolean | undefined | null;

let unauthorizedHandler: (() => void) | undefined;
/** AuthProvider đăng ký hàm này để tự đăng xuất khi token hết hạn hoặc tài khoản bị khóa. */
export function setUnauthorizedHandler(handler: (() => void) | undefined) {
  unauthorizedHandler = handler;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  token?: string;
}

/** Hàm gọi API dùng chung: gắn JWT, chuyển query, và đọc thông báo lỗi tiếng Việt từ NestJS. */
export async function request<T>(path: string, { method = 'GET', body, query, token }: RequestOptions = {}): Promise<T> {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') search.append(key, String(value));
  }
  const url = `${API_URL}${path}${search.size ? `?${search}` : ''}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(`Không kết nối được máy chủ (${API_URL}). Kiểm tra mạng hoặc EXPO_PUBLIC_API_URL.`, 0);
  }

  const text = await response.text();
  const data = text ? safeJson(text) : undefined;
  if (!response.ok) {
    if (response.status === 401 && token) unauthorizedHandler?.();
    const message = (data as { message?: string | string[] } | undefined)?.message;
    throw new ApiError(
      Array.isArray(message) ? message.join('\n') : message || text || `Lỗi ${response.status}`,
      response.status,
    );
  }
  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Ảnh sản phẩm được lưu dạng đường dẫn tương đối `/uploads/...` trên backend. */
export function resolveImageUrl(path?: string): string | undefined {
  if (!path) return undefined;
  return /^(https?:|data:|file:|blob:)/.test(path) ? path : `${API_URL}${path}`;
}
