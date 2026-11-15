import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import { roleCan } from '../constants/permissions';
import { ApiError, setUnauthorizedHandler } from '../services/api';
import { authService } from '../services/auth.service';
import { tokenStorage } from '../services/session-storage';
import { AuthUser, Permission } from '../types';

interface AuthStore {
  token?: string;
  user?: AuthUser;
  restoring: boolean;
  sessionError?: string;
  restoreSession: () => Promise<void>;
  retrySession: () => Promise<void>;
  signIn: (token: string, user: AuthUser) => Promise<void>;
  signOut: () => Promise<void>;
  /** Đọc lại hồ sơ từ server (sau khi admin đổi vai trò...). */
  refreshUser: () => Promise<void>;
  can: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthStore | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<{ token: string; user: AuthUser }>();
  const [restoring, setRestoring] = useState(true);
  const [error, setError] = useState<{ message: string; action: 'restore' | 'clear' }>();
  const generation = useRef<object>({});
  const activeToken = useRef<string | undefined>(undefined);
  const writes = useRef<Promise<void>>(Promise.resolve());

  const persist = useCallback((token?: string) => {
    const next = writes.current.catch(() => undefined).then(() => token ? tokenStorage.set(token) : tokenStorage.clear());
    writes.current = next;
    return next;
  }, []);

  const signOut = useCallback(async () => {
    const id = {};
    generation.current = id;
    activeToken.current = undefined;
    setSession(undefined);
    setRestoring(true);
    setError(undefined);
    try {
      await persist();
    } catch {
      if (id === generation.current) setError({ message: 'Chưa xóa được phiên trên thiết bị. Hãy thử đăng xuất lại.', action: 'clear' });
    } finally {
      if (id === generation.current) setRestoring(false);
    }
  }, [persist]);

  const signIn = useCallback(async (token: string, user: AuthUser) => {
    const id = {};
    generation.current = id;
    try {
      await persist(token);
      if (id !== generation.current) return;
      activeToken.current = token;
      setSession({ token, user });
      setError(undefined);
      setRestoring(false);
    } catch {
      throw new Error('Không thể lưu phiên đăng nhập trên thiết bị. Vui lòng thử lại.');
    }
  }, [persist]);

  const restoreSession = useCallback(async () => {
    const id = {};
    generation.current = id;
    setRestoring(true);
    setError(undefined);
    try {
      await writes.current.catch(() => undefined);
      const token = await tokenStorage.get();
      if (id !== generation.current) return;
      if (!token) {
        activeToken.current = undefined;
        setSession(undefined);
        return;
      }
      activeToken.current = token;
      const { user } = await authService.me(token);
      if (id === generation.current) setSession({ token, user });
    } catch (cause) {
      if (id !== generation.current) return;
      if (cause instanceof ApiError && cause.status === 401) {
        await signOut();
      } else {
        setError({ message: 'Chưa khôi phục được phiên. Kiểm tra kết nối máy chủ hoặc bộ nhớ thiết bị rồi thử lại.', action: 'restore' });
      }
    } finally {
      if (id === generation.current) setRestoring(false);
    }
  }, [signOut]);

  useEffect(() => {
    setUnauthorizedHandler((token) => {
      if (token === activeToken.current) void signOut();
    });
    return () => setUnauthorizedHandler(undefined);
  }, [signOut]);

  useEffect(() => {
    let mounted = true;
    void Promise.resolve().then(() => { if (mounted) void restoreSession(); });
    return () => { mounted = false; generation.current = {}; };
  }, [restoreSession]);

  const refreshUser = useCallback(async () => {
    const token = activeToken.current;
    const id = generation.current;
    if (!token) return;
    const { user } = await authService.me(token);
    if (id === generation.current) setSession((current) => (current?.token === token ? { ...current, user } : current));
  }, []);

  const retrySession = useCallback(() => error?.action === 'clear' ? signOut() : restoreSession(), [error, signOut, restoreSession]);

  const value = useMemo<AuthStore>(
    () => ({
      token: session?.token,
      user: session?.user,
      restoring,
      sessionError: error?.message,
      restoreSession,
      retrySession,
      signIn,
      signOut,
      refreshUser,
      can: (permission) => roleCan(session?.user.role, permission),
    }),
    [session, restoring, error, restoreSession, retrySession, signIn, signOut, refreshUser],
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
