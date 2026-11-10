import { AppNotification, Paginated } from '../types';
import { request } from './api';

export const notificationService = {
  list: (token: string, query: { page?: number; limit?: number; unreadOnly?: boolean } = {}) =>
    request<Paginated<AppNotification> & { unreadCount: number }>('/notifications', { token, query: { ...query } }),

  unreadCount: (token: string) => request<{ unreadCount: number }>('/notifications/unread-count', { token }),

  markRead: (token: string, id: string) =>
    request<AppNotification>(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST', token }),

  markAllRead: (token: string) => request<{ unreadCount: number }>('/notifications/read-all', { method: 'POST', token }),

  registerPushToken: (token: string, pushToken: string) =>
    request<{ registered: boolean }>('/notifications/push-token', { method: 'POST', token, body: { token: pushToken } }),
};
