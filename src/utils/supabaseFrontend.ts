/**
 * ============================================================
 * SUPABASE CLIENT — FRONTEND (Browser)
 * ============================================================
 * Cliente Supabase para uso direto no frontend.
 * Utiliza a ANON_KEY (segura para o browser) com Row Level Security.
 * ============================================================
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const supabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

let _client: SupabaseClient | null = null;

export function getSupabaseFrontend(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase Frontend] VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY não configuradas.');
    return null;
  }
  if (!_client) {
    _client = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _client;
}
