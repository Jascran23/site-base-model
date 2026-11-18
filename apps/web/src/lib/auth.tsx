import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, setCsrf } from './api';

export interface SessionUser { id: number; name: string; email: string; role: 'master' | 'client_admin' }
interface Me { user: SessionUser; permissions: string[]; csrfToken: string }

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  can: (key: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const apply = (data: Me | null) => { setCsrf(data?.csrfToken ?? ''); setMe(data); };

  useEffect(() => {
    api<Me>('/auth/me').then(apply).catch(() => apply(null)).finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    apply(await api<Me>('/auth/login', { method: 'POST', body: { email, password } }));
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
    apply(null);
  }, []);

  const value = useMemo<AuthState>(() => ({
    user: me?.user ?? null,
    loading,
    // Apenas conveniência de UI: o back-end valida toda ação.
    can: (key) => !!me && me.permissions.includes(key),
    login, logout,
  }), [me, loading, login, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fora do AuthProvider');
  return v;
}
