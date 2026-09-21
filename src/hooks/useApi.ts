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
import { getApiBaseUrl } from '../utils/apiConfig';

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
  const { token, logout, empresaAtiva } = useAuth();

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

    if (empresaAtiva?.id) {
      headers['x-empresa-ativa-id'] = empresaAtiva.id;
    }

    const fetchOptions: RequestInit = {
      ...restOptions,
      headers,
    };

    if (body !== undefined) {
      fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    try {
      const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      const response = await fetch(`${getApiBaseUrl()}${cleanEndpoint}`, fetchOptions);
      const data = await response.json().catch(() => ({}));

      if (response.status === 401 && (data?.code === 'AUTH_TOKEN_EXPIRED' || data?.code === 'AUTH_USER_NOT_FOUND' || data?.code === 'AUTH_USER_BLOCKED')) {
        // Token expirado ou usuário não encontrado/bloqueado — forçar logout
        logout();
        return { ok: false, status: 401, data, error: data?.error || 'Sessão expirada. Faça login novamente.' };
      }

      if (!response.ok) {
        let errDesc = data?.error || data?.message;
        if (!errDesc) {
          if (response.status === 504) {
            errDesc = cleanEndpoint.includes('/ai')
              ? 'Erro 504 (Gateway Timeout): O serviço de Inteligência Artificial demorou mais de 25 segundos para responder.'
              : 'Erro 504 (Gateway Timeout): Os webservices demoraram mais de 25 segundos para responder.';
          } else if (response.status === 502) {
            errDesc = cleanEndpoint.includes('/ai')
              ? 'Erro 502 (Bad Gateway): O serviço de Inteligência Artificial está temporariamente indisponível.'
              : 'Erro 502 (Bad Gateway): O servidor intermediário ou webservice governamental está temporariamente indisponível.';
          } else if (response.status === 503) {
            errDesc = 'Erro 503 (Serviço Indisponível): O serviço está temporariamente sobrecarregado ou em manutenção.';
          } else {
            errDesc = `Erro ${response.status}`;
          }
        }
        return {
          ok: false,
          status: response.status,
          data,
          error: errDesc,
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
  }, [token, logout, empresaAtiva?.id]);

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
    if (empresaAtiva?.id) {
      headers['x-empresa-ativa-id'] = empresaAtiva.id;
    }
    // NÃO definir Content-Type — o browser insere com boundary correto

    try {
      const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
      const response = await fetch(`${getApiBaseUrl()}${cleanEndpoint}`, {
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
  }, [token, empresaAtiva?.id]);

  return { get, post, put, del, uploadFile, request };
}
