import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { roleCan } from '../constants/permissions';
import { setUnauthorizedHandler } from '../services/api';
import { authService } from '../services/auth.service';
import { AuthUser, Permission } from '../types';

interface AuthStore {
  token?: string;
  user?: AuthUser;
  signIn: (token: string, user: AuthUser) => void;
  signOut: () => void;
  /** Đọc lại hồ sơ từ server (sau khi admin đổi vai trò...). */
  refreshUser: () => Promise<void>;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthStore | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<{ token: string; user: AuthUser }>();

  const signOut = useCallback(() => setSession(undefined), []);

  useEffect(() => {
    setUnauthorizedHandler(signOut);
    return () => setUnauthorizedHandler(undefined);
  }, [signOut]);

  const refreshUser = useCallback(async () => {
    if (!session) return;
    const { user } = await authService.me(session.token);
    setSession((current) => (current ? { ...current, user } : current));
  }, [session]);

  const value = useMemo<AuthStore>(
    () => ({
      token: session?.token,
      user: session?.user,
      signIn: (token, user) => setSession({ token, user }),
      signOut,
      refreshUser,
      can: (permission) => roleCan(session?.user.role, permission),
    }),
    [session, signOut, refreshUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

/** Token đã đăng nhập (chỉ dùng trong các màn hình sau đăng nhập). */
export function useToken(): string {
  const { token } = useAuth();
  if (!token) throw new Error('Chưa đăng nhập');
  return token;
}
