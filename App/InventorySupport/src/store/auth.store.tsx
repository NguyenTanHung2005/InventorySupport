import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { AuthUser } from '../types';

interface AuthStore { token?: string; user?: AuthUser; signIn: (token: string, user: AuthUser) => void; signOut: () => void; }
const AuthContext = createContext<AuthStore | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<{ token: string; user: AuthUser }>();
  const value = useMemo<AuthStore>(() => ({ token: session?.token, user: session?.user, signIn: (token, user) => setSession({ token, user }), signOut: () => setSession(undefined) }), [session]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
