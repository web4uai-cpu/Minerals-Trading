'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  api,
  setTokens,
  clearTokens,
  loadTokens,
  getAccessToken,
  ApiRequestError,
} from '@/lib/api-client';
import type { JwtPayload } from '@khanij/types';

interface AuthState {
  user: JwtPayload | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterParams) => Promise<void>;
  logout: () => Promise<void>;
}

interface RegisterParams {
  email: string;
  password: string;
  legalName: string;
  orgType: string;
  state: string;
  phone: string;
}

interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: JwtPayload;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const base64 = token.split('.')[1] ?? '';
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    loadTokens();
    const token = getAccessToken();
    if (token) {
      const payload = decodeJwtPayload(token);
      if (payload && payload.exp && payload.exp * 1000 > Date.now()) {
        setState({ user: payload, isLoading: false, isAuthenticated: true });
      } else {
        clearTokens();
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    } else {
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setTokens(data.accessToken, data.refreshToken);
    const payload = decodeJwtPayload(data.accessToken);
    setState({ user: payload, isLoading: false, isAuthenticated: true });
  }, []);

  const register = useCallback(async (input: RegisterParams) => {
    const data = await api<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setTokens(data.accessToken, data.refreshToken);
    const payload = decodeJwtPayload(data.accessToken);
    setState({ user: payload, isLoading: false, isAuthenticated: true });
  }, []);

  const logout = useCallback(async () => {
    try {
      loadTokens();
      const refreshToken = localStorage.getItem('kn_refresh');
      if (refreshToken) {
        await api('/api/v1/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refreshToken }),
        });
      }
    } catch {
      // Ignore logout errors
    } finally {
      clearTokens();
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { ApiRequestError };
