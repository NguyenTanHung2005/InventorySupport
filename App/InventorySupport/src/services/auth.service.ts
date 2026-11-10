import { AuthResponse, AuthUser, Permission } from '../types';
import { request } from './api';

export const authService = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } }),

  register: (name: string, email: string, password: string) =>
    request<{ message: string; user: AuthUser }>('/auth/register', {
      method: 'POST',
      body: { name, email, password },
    }),

  me: (token: string) => request<{ user: AuthUser; permissions: Permission[] }>('/auth/me', { token }),

  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    request<{ message: string }>('/auth/change-password', {
      method: 'POST',
      token,
      body: { currentPassword, newPassword },
    }),
};
