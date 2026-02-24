/**
 * ROBOWAR V2 — API Client
 * Typed fetch wrapper with JWT auto-attach and 401 auto-refresh.
 *
 * Base URL: import.meta.env.VITE_API_URL (default: http://localhost:3000)
 * Auth:     Bearer <accessToken> from useAuthStore
 * Refresh:  POST /v2/auth/refresh (cookie-based rotate) on 401
 */

import { useAuthStore } from '../store/authStore';

export const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3000') + '/v2';

// ─── Request helper ──────────────────────────────────────────────────────────

type RequestOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  /** Skip JWT header even if a token is stored (e.g. public endpoints) */
  skipAuth?: boolean;
};

let _refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // sends the httpOnly refresh_token cookie
    });
    if (!res.ok) return false;
    const data = await res.json() as { access_token: string };
    useAuthStore.getState().setAccessToken(data.access_token);
    return true;
  } catch {
    return false;
  }
}

export async function apiRequest<T = unknown>(
  path: string,
  opts: RequestOptions = {}
): Promise<T> {
  const { body, skipAuth, ...fetchOpts } = opts;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOpts.headers as Record<string, string>),
  };

  if (!skipAuth) {
    const token = useAuthStore.getState().accessToken;
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const init: RequestInit = {
    ...fetchOpts,
    headers,
    credentials: 'include',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  let res = await fetch(`${API_BASE}${path}`, init);

  // ── 401: attempt token refresh once ─────────────────────────────────────
  if (res.status === 401 && !skipAuth) {
    // Deduplicate concurrent refresh attempts
    if (!_refreshing) {
      _refreshing = refreshTokens().finally(() => { _refreshing = null; });
    }
    const refreshed = await _refreshing;

    if (refreshed) {
      // Retry original request with the new access token
      const newToken = useAuthStore.getState().accessToken;
      if (newToken) headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(`${API_BASE}${path}`, { ...init, headers });
    } else {
      // Refresh failed → force logout
      useAuthStore.getState().logout();
      throw new ApiError(401, 'SESSION_EXPIRED', 'Session expired. Please log in again.');
    }
  }

  if (!res.ok) {
    let errBody: { code?: string; message?: string } = {};
    try { errBody = await res.json(); } catch { /* empty body */ }
    throw new ApiError(res.status, errBody.code ?? 'API_ERROR', errBody.message ?? res.statusText);
  }

  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;

  return res.json() as Promise<T>;
}

// ─── Convenience methods ─────────────────────────────────────────────────────

export const api = {
  get:    <T>(path: string, opts?: RequestOptions) =>
    apiRequest<T>(path, { method: 'GET', ...opts }),

  post:   <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiRequest<T>(path, { method: 'POST', body, ...opts }),

  put:    <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiRequest<T>(path, { method: 'PUT', body, ...opts }),

  patch:  <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    apiRequest<T>(path, { method: 'PATCH', body, ...opts }),

  delete: <T>(path: string, opts?: RequestOptions) =>
    apiRequest<T>(path, { method: 'DELETE', ...opts }),
};

// ─── Error class ─────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
