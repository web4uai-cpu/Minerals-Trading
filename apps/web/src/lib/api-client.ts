const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface TokenStore {
  accessToken: string | null;
  refreshToken: string | null;
}

const tokens: TokenStore = {
  accessToken: null,
  refreshToken: null,
};

export function setTokens(access: string, refresh: string) {
  tokens.accessToken = access;
  tokens.refreshToken = refresh;
  if (typeof window !== 'undefined') {
    localStorage.setItem('kn_access', access);
    localStorage.setItem('kn_refresh', refresh);
  }
}

export function clearTokens() {
  tokens.accessToken = null;
  tokens.refreshToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('kn_access');
    localStorage.removeItem('kn_refresh');
  }
}

export function loadTokens() {
  if (typeof window !== 'undefined') {
    tokens.accessToken = localStorage.getItem('kn_access');
    tokens.refreshToken = localStorage.getItem('kn_refresh');
  }
}

export function getAccessToken(): string | null {
  return tokens.accessToken;
}

async function refreshAccessToken(): Promise<boolean> {
  if (!tokens.refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    if (!res.ok) {
      clearTokens();
      return false;
    }

    const data = (await res.json()) as { accessToken: string; refreshToken: string };
    setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

export interface ApiError {
  code: string;
  message: string;
  traceId?: string;
}

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public body: ApiError,
  ) {
    super(body.message);
    this.name = 'ApiRequestError';
  }
}

export async function api<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  loadTokens();

  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (tokens.accessToken) {
      headers['Authorization'] = `Bearer ${tokens.accessToken}`;
    }

    return fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  };

  let res = await doFetch();

  if (res.status === 401 && tokens.refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await doFetch();
    }
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => ({
      code: 'UNKNOWN',
      message: res.statusText,
    }))) as ApiError;
    throw new ApiRequestError(res.status, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
