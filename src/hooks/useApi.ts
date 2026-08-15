/**
 * ============================================================
 * HOOK useApi — COMUNICAÇÃO CENTRALIZADA COM O BACKEND
 * ============================================================
 * Todas as chamadas HTTP ao backend passam por aqui.
 * Injeta automaticamente o JWT Bearer token do AuthContext.
 * Implementa refresh automático em caso de token expirado.
 * ============================================================
 */

import { useAuth } from '../contexts/AuthContext';
import { useCallback } from 'react';

const API_BASE = 'http://localhost:3001/api';

interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: any;
  skipAuth?: boolean;
}

interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data: T;
  error?: string;
}

export function useApi() {
  const { token, logout } = useAuth();

  const request = useCallback(async <T = any>(
    endpoint: string,
    options: ApiOptions = {}
  ): Promise<ApiResponse<T>> => {
    const { body, skipAuth, headers: extraHeaders, ...restOptions } = options;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...extraHeaders as Record<string, string>,
    };

    if (!skipAuth && token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const fetchOptions: RequestInit = {
      ...restOptions,
      headers,
    };

    if (body !== undefined) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, fetchOptions);
      const data = await response.json().catch(() => ({}));

      if (response.status === 401 && (data?.code === 'AUTH_TOKEN_EXPIRED' || data?.code === 'AUTH_USER_NOT_FOUND' || data?.code === 'AUTH_USER_BLOCKED')) {
        // Token expirado ou usuário não encontrado/bloqueado — forçar logout
        logout();
        return { ok: false, status: 401, data, error: data?.error || 'Sessão expirada. Faça login novamente.' };
      }

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          data,
          error: data?.error || data?.message || `Erro ${response.status}`,
        };
      }

      return { ok: true, status: response.status, data };
    } catch (err: any) {
      console.error(`[useApi] Falha em ${endpoint}:`, err);
      return {
        ok: false,
        status: 0,
        data: {} as T,
        error: err.message || 'Erro de conexão com o servidor.',
      };
    }
  }, [token, logout]);

  // ── Atalhos HTTP ──────────────────────────────────────────

  const get = useCallback(<T = any>(endpoint: string, opts?: ApiOptions) =>
    request<T>(endpoint, { method: 'GET', ...opts }), [request]);

  const post = useCallback(<T = any>(endpoint: string, body?: any, opts?: ApiOptions) =>
    request<T>(endpoint, { method: 'POST', body, ...opts }), [request]);

  const put = useCallback(<T = any>(endpoint: string, body?: any, opts?: ApiOptions) =>
    request<T>(endpoint, { method: 'PUT', body, ...opts }), [request]);

  const del = useCallback(<T = any>(endpoint: string, opts?: ApiOptions) =>
    request<T>(endpoint, { method: 'DELETE', ...opts }), [request]);

  // ── Upload de arquivo (multipart/form-data) ───────────────

  const uploadFile = useCallback(async <T = any>(
    endpoint: string,
    formData: FormData
  ): Promise<ApiResponse<T>> => {
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    // NÃO definir Content-Type — o browser insere com boundary correto

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return { ok: false, status: response.status, data, error: data?.error || data?.message || `Erro ${response.status}` };
      }

      return { ok: true, status: response.status, data };
    } catch (err: any) {
      return { ok: false, status: 0, data: {} as T, error: err.message };
    }
  }, [token]);

  return { get, post, put, del, uploadFile, request };
}
