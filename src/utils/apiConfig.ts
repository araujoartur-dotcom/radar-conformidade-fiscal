/**
 * ============================================================
 * CONFIGURAÇÃO CENTRAL DE URL DA API FRONTEND
 * ============================================================
 * Resolve a URL base para todas as chamadas HTTP do frontend.
 * 
 * PADRÃO DE ARQUITETURA BLINDADA (Same-Origin Proxy First):
 * 1. Em produção (Netlify): Usa '/api' relativo, passando pelo
 *    proxy reverso do Netlify ([[redirects]] em netlify.toml).
 *    Isso elimina 100% dos bloqueios de CORS, preflights OPTIONS
 *    e problemas de headers customizados no navegador do cliente.
 * 2. Em desenvolvimento (Vite): O Vite dev server já faz proxy de
 *    '/api' para http://localhost:3001 (configurado em vite.config.ts).
 * 3. Se explicitamente exigido (VITE_FORCE_DIRECT_API=true),
 *    utiliza a URL absoluta configurada em VITE_API_URL.
 * ============================================================
 */

export function getApiBaseUrl(): string {
  const envUrl = (((import.meta as any).env?.VITE_API_URL as string) || '').trim().replace(/\/+$/, '');
  const forceDirect = ((import.meta as any).env?.VITE_FORCE_DIRECT_API as string) === 'true';

  // Se o operador forçou explicitamente a conexão direta com o backend
  if (forceDirect && envUrl) {
    return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;
  }

  // Se estamos rodando no navegador em um domínio público (Netlify, Vercel ou domínio próprio)
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    // Sempre usa o proxy reverso do mesmo domínio (/api), garantindo imunidade total a CORS
    return '/api';
  }

  // Em ambiente local sem proxy explícito ou fallback
  if (!envUrl) {
    return '/api';
  }

  return envUrl.endsWith('/api') ? envUrl : `${envUrl}/api`;
}

export default getApiBaseUrl;
