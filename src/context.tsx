import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './lib/api';

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  photoURL?: string;
  role: string;
  permissions: string[];
  coFounderId?: string;
  employeeId?: string;
  theme?: 'light' | 'dark' | 'system';
  notificationPrefs?: Record<string, boolean>;
  hasPassword?: boolean;
};

type AuthValue = {
  user: SessionUser | null;
  ready: boolean;
  refresh: () => Promise<void>;
  setUser: (user: SessionUser | null) => void;
  can: (permission: string) => boolean;
};

const AuthContext = createContext<AuthValue | null>(null);
const ToastContext = createContext<(message: string, tone?: 'ok' | 'danger') => void>(() => undefined);

export function AppState({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'danger' } | null>(null);

  const refresh = async () => {
    const response = await api.get('/auth/me');
    setUser(response.data.data);
  };

  useEffect(() => {
    api.get('/auth/me').then((response) => setUser(response.data.data)).catch(() => setUser(null)).finally(() => setReady(true));
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem('dm-theme') || user?.theme || 'light';
    const dark = stored === 'dark' || (stored === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  }, [user]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const value = useMemo<AuthValue>(() => ({
    user,
    ready,
    refresh,
    setUser,
    can: (permission: string) => Boolean(user && (user.role === 'master_admin' || user.permissions.includes('*') || user.permissions.includes(permission))),
  }), [user, ready]);

  return (
    <AuthContext.Provider value={value}>
      <ToastContext.Provider value={(message, tone = 'ok') => setToast({ message, tone })}>
        {children}
        {toast && (
          <div className={`fixed bottom-5 right-5 z-[70] max-w-sm rounded-2xl border px-4 py-3 text-sm shadow-card ${toast.tone === 'danger' ? 'border-danger/30 bg-card text-danger' : 'border-line bg-card text-ink'}`}>
            {toast.message}
          </div>
        )}
      </ToastContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('Auth missing');
  return value;
}

export function useToast() {
  return useContext(ToastContext);
}

export function applyTheme(theme: 'light' | 'dark' | 'system') {
  localStorage.setItem('dm-theme', theme);
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}
