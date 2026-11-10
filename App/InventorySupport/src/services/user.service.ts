import { AuthUser, Paginated, UserRole } from '../types';
import { request } from './api';

export interface UserInput {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
  active?: boolean;
}

export const userService = {
  list: (token: string, query: { page?: number; limit?: number; search?: string; role?: UserRole } = {}) =>
    request<Paginated<AuthUser>>('/users', { token, query: { ...query } }),

  create: (token: string, input: Required<Pick<UserInput, 'name' | 'email' | 'password' | 'role'>> & { active?: boolean }) =>
    request<AuthUser>('/users', { method: 'POST', token, body: input }),

  update: (token: string, id: string, input: UserInput) =>
    request<AuthUser>(`/users/${encodeURIComponent(id)}`, { method: 'PATCH', token, body: input }),

  remove: (token: string, id: string) =>
    request<{ id: string }>(`/users/${encodeURIComponent(id)}`, { method: 'DELETE', token }),
};
