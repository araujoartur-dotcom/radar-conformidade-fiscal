/**
 * ============================================================
 * CONFIGURAÇÃO CENTRAL DE URL DA API FRONTEND
 * ============================================================
 * Resolve a URL base para todas as chamadas HTTP do frontend.
 * Garante que a rota termine com '/api', independente de como
 * o usuário cadastrou o VITE_API_URL (com ou sem /api, com ou sem barra final).
 * ============================================================
 */

export function getApiBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/+$/, '');
  
  // Se não foi configurado (ex: desenvolvimento local com proxy Vite)
  if (!envUrl) {
    return '/api';
  }
  
  // Se já termina com '/api', usa direto; senão, adiciona '/api'
  return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;
}

export default getApiBaseUrl;
