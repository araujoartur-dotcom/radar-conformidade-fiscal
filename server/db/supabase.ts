/**
 * ============================================================
 * CLIENTE SUPABASE — RADAR DE CONFORMIDADE FISCAL
 * ============================================================
 * Gerencia a conexão com o Supabase (PostgreSQL Cloud).
 * Fornece cliente com Service Role para operações administrativas
 * seguras no backend e utilitários de checagem.
 * ============================================================
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE } from '../config';

let supabaseAdminClient: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE.URL && (SUPABASE.SERVICE_ROLE_KEY || SUPABASE.ANON_KEY));
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (!supabaseAdminClient) {
    const key = SUPABASE.SERVICE_ROLE_KEY || SUPABASE.ANON_KEY;
    supabaseAdminClient = createClient(SUPABASE.URL, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    console.log('⚡ Conexão Supabase inicializada com sucesso:', SUPABASE.URL);
  }

  return supabaseAdminClient;
}

export default {
  isSupabaseConfigured,
  getSupabaseAdmin,
};
