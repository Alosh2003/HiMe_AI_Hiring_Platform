import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

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
  register: (name: string, email: string, password: string, role: 'seeker' | 'company') => Promise<void>;
  logout: () => void;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'hime_ai_token';
const USER_KEY = 'hime_ai_user';

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
