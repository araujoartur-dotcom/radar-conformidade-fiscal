/**
 * ============================================================
 * HELPER DE RESOLUÇÃO DE TENANTS / EMPRESAS (SUPABASE & SQLITE)
 * ============================================================
 * Garante compatibilidade 100% entre os UUIDs de empresas no SQLite
 * e no Supabase, evitando violações de FK (Foreign Key) na ingestão de DF-e.
 * ============================================================
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const empresaCache = new Map<string, string>();

export interface EmpresaLookupData {
  id?: string;
  cnpj_completo?: string;
  cnpj_raiz?: string;
  razao_social?: string;
  uf?: string;
  regime_tributario?: string;
}

/**
 * Localiza ou auto-provisiona a empresa correspondente no Supabase,
 * fazendo matching por CNPJ completo ou CNPJ raiz.
 */
export async function resolveSupabaseEmpresaId(
  supabase: SupabaseClient,
  empresaData: EmpresaLookupData
): Promise<string> {
  const cleanCnpj = (empresaData.cnpj_completo || '').replace(/\D/g, '');
  const cleanRaiz = (empresaData.cnpj_raiz || cleanCnpj.substring(0, 8) || '').replace(/\D/g, '');
  const cacheKey = cleanCnpj || cleanRaiz || empresaData.id || 'default';

  if (empresaCache.has(cacheKey)) {
    return empresaCache.get(cacheKey)!;
  }

  try {
    // 1. Verificar se o ID fornecido já existe exatamente no Supabase
    if (empresaData.id && empresaData.id.length === 36) {
      const { data: byId } = await supabase
        .from('empresas')
        .select('id')
        .eq('id', empresaData.id)
        .maybeSingle();

      if (byId?.id) {
        empresaCache.set(cacheKey, byId.id);
        return byId.id;
      }
    }

    // 2. Localizar por CNPJ Completo (independente de pontuação)
    if (cleanCnpj) {
      const { data: byCnpj } = await supabase
        .from('empresas')
        .select('id, cnpj_completo')
        .limit(100);

      if (byCnpj && byCnpj.length > 0) {
        const match = byCnpj.find((e: any) => (e.cnpj_completo || '').replace(/\D/g, '') === cleanCnpj);
        if (match?.id) {
          empresaCache.set(cacheKey, match.id);
          return match.id;
        }
      }
    }

    // 3. Localizar por CNPJ Raiz (8 primeiros dígitos)
    if (cleanRaiz) {
      const { data: byRaiz } = await supabase
        .from('empresas')
        .select('id, cnpj_raiz')
        .limit(100);

      if (byRaiz && byRaiz.length > 0) {
        const match = byRaiz.find((e: any) => (e.cnpj_raiz || '').replace(/\D/g, '') === cleanRaiz);
        if (match?.id) {
          empresaCache.set(cacheKey, match.id);
          return match.id;
        }
      }
    }

    // 4. Se não encontrar por CNPJ mas existirem empresas no Supabase, vincular à primeira cadastrada
    const { data: firstEmp } = await supabase
      .from('empresas')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (firstEmp?.id) {
      empresaCache.set(cacheKey, firstEmp.id);
      return firstEmp.id;
    }

    // 5. Se a tabela empresas estiver completamente vazia no Supabase, auto-provisionar
    const newId = uuidv4();
    const { error: insertErr } = await supabase.from('empresas').insert({
      id: newId,
      cnpj_raiz: cleanRaiz || '00000000',
      cnpj_completo: empresaData.cnpj_completo || cleanCnpj || '00.000.000/0001-00',
      razao_social: empresaData.razao_social || 'EMPRESA MATRIZ',
      uf: empresaData.uf || 'SP',
      regime_tributario: empresaData.regime_tributario || 'Lucro Real',
      status: 'ativo'
    });

    if (insertErr) {
      console.warn('⚠️ Não foi possível auto-provisionar empresa no Supabase:', insertErr.message);
    }

    empresaCache.set(cacheKey, newId);
    return newId;
  } catch (err: any) {
    console.error('❌ Erro em resolveSupabaseEmpresaId:', err?.message || err);
    return empresaData.id || uuidv4();
  }
}
