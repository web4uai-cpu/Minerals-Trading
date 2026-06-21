import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setTokens, clearTokens, loadTokens, getAccessToken } from '../api/client';
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
}

const AuthContext = createContext<AuthContextValue | null>(null);

function base64Decode(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let i = 0;
  const input = str.replace(/[^A-Za-z0-9+/=]/g, '');
  while (i < input.length) {
    const a = chars.indexOf(input[i++] ?? '');
    const b = chars.indexOf(input[i++] ?? '');
    const c = chars.indexOf(input[i++] ?? '');
    const d = chars.indexOf(input[i++] ?? '');
    const triple = (a << 18) | (b << 12) | (c << 6) | d;
    output += String.fromCharCode((triple >> 16) & 0xff);
    if (c !== 64) output += String.fromCharCode((triple >> 8) & 0xff);
    if (d !== 64) output += String.fromCharCode(triple & 0xff);
  }
  return output;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const base64 = token.split('.')[1] ?? '';
    const json = base64Decode(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  useEffect(() => {
    (async () => {
      await loadTokens();
      const token = getAccessToken();
      if (token) {
        const payload = decodeJwtPayload(token);
        if (payload && payload.exp && payload.exp * 1000 > Date.now()) {
          setState({ user: payload, isLoading: false, isAuthenticated: true });
        } else {
          await clearTokens();
          setState({ user: null, isLoading: false, isAuthenticated: false });
        }
      } else {
        setState({ user: null, isLoading: false, isAuthenticated: false });
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<AuthResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await setTokens(data.accessToken, data.refreshToken);
    const payload = decodeJwtPayload(data.accessToken);
    setState({ user: payload, isLoading: false, isAuthenticated: true });
  }, []);

  const register = useCallback(async (input: RegisterParams) => {
    const data = await api<AuthResponse>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    await setTokens(data.accessToken, data.refreshToken);
    const payload = decodeJwtPayload(data.accessToken);
    setState({ user: payload, isLoading: false, isAuthenticated: true });
  }, []);

  const logout = useCallback(async () => {
    await clearTokens();
    setState({ user: null, isLoading: false, isAuthenticated: false });
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
