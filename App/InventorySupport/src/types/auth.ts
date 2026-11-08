export type UserRole = 'OWNER' | 'MANAGER' | 'STAFF' | 'VIEWER';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  storeId: string;
}

export interface AuthResponse {
  accessToken: string;
  user: AuthUser;
}
