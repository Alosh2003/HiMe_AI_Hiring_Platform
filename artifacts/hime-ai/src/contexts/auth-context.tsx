import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';

export type UserRole = 'seeker' | 'company' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  avatarUrl?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string, role: 'seeker' | 'company') => Promise<{ onboarding: boolean }>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
  /** Merge a partial user update (e.g. a fresh avatarUrl) into the session. */
  updateUser: (patch: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'hime_ai_token';
const USER_KEY = 'hime_ai_user';

/** GET /auth/me payload. `null` means the field is empty server-side; keys the
 *  payload omits keep whatever the stored session already had. */
type MeResponse = Partial<AuthUser> & { phone?: string | null; avatarUrl?: string | null };

/** The server wins for identity, but only for the fields it actually sent —
 *  an older stored copy (or a leaner test fixture) must not lose its values. */
function mergeSessionUser(prev: AuthUser, fresh: MeResponse): AuthUser {
  return {
    id: fresh.id ?? prev.id,
    email: fresh.email ?? prev.email,
    name: fresh.name ?? prev.name,
    role: fresh.role ?? prev.role,
    phone: 'phone' in fresh ? fresh.phone ?? undefined : prev.phone,
    avatarUrl: 'avatarUrl' in fresh ? fresh.avatarUrl ?? undefined : prev.avatarUrl,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Initialize synchronously so the first paint already reflects auth state.
  // Loading in useEffect made ProtectedRoute flash the login screen.
  const [{ token, user }, setAuth] = useState(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    const savedUser = localStorage.getItem(USER_KEY);
    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser) as AuthUser;
        if (parsed?.role) {
          return { token: savedToken, user: parsed };
        }
      } catch {
        /* fall through to clear */
      }
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    return { token: null, user: null };
  });

  const persist = useCallback((nextToken: string, nextUser: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setAuth({ token: nextToken, user: nextUser });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Login failed');
    }

    const data = await response.json();
    persist(data.token, data.user as AuthUser);
  }, [persist]);

  const register = useCallback(async (name: string, email: string, password: string, role: 'seeker' | 'company') => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Registration failed');
    }

    const data = await response.json();
    persist(data.token, data.user as AuthUser);
    return { onboarding: data.onboarding !== false };
  }, [persist]);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setAuth({ token: null, user: null });
  }, []);

  const hasRole = useCallback((roles: UserRole[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  }, [user]);

  // The stored copy can go stale — e.g. sessions written before avatarUrl
  // existed never see the header photo until the next sign-in. Re-sync once
  // per session from the real API. Best-effort by design: a failed refresh
  // keeps the stored session exactly as it is and never signs the user out.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void (async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
        const response = await fetch(`${baseUrl}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const fresh = (await response.json()) as MeResponse | null;
        if (cancelled || !fresh?.id) return;
        setAuth((prev) => {
          if (!prev.user || prev.token !== token) return prev;
          const nextUser = mergeSessionUser(prev.user, fresh);
          // Nothing new — skip the state churn and the storage write.
          if (JSON.stringify(nextUser) === JSON.stringify(prev.user)) return prev;
          return { token: prev.token, user: nextUser };
        });
      } catch {
        /* offline or demo mode — the stored session stays authoritative */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Mirror every in-memory user change into storage so the next page load
  // boots with the freshest copy (login writes via persist; this covers the
  // silent refresh and updateUser).
  useEffect(() => {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  }, [user]);

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setAuth((prev) => {
      if (!prev.user) return prev;
      return { token: prev.token, user: { ...prev.user, ...patch } };
    });
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isAuthenticated: !!token && !!user,
      isLoading: false,
      login,
      register,
      logout,
      hasRole,
      updateUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
