/**
 * ============================================================
 * SEED SUPABASE — DADOS INICIAIS NO POSTGRESQL
 * ============================================================
 * Executa a inserção dos dados essenciais (Admin, Empresa,
 * Alíquotas, cClassTrib 6 dígitos e CFOP) diretamente no Supabase.
 * ============================================================
 */

import { getSupabaseAdmin, isSupabaseConfigured } from './supabase';
import bcrypt from 'bcryptjs';
import { AUTH } from '../config';

export async function seedSupabaseDatabase(): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.log('ℹ️  Supabase não configurado. Seed do Supabase ignorado.');
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return;

  try {
    console.log('🌱 Verificando dados iniciais no Supabase...');

    // 1. Verificar Admin
    const { data: users, error: userErr } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', 'admin@radarfiscal.com.br');

    let adminId: string;

    if (!users || users.length === 0) {
      const senhaHash = bcrypt.hashSync('Admin@RadarFiscal2026!', AUTH.BCRYPT_ROUNDS);
      const { data: newUser, error: insertUsrErr } = await supabase
        .from('usuarios')
        .insert({
          nome: 'Administrador Master',
          email: 'admin@radarfiscal.com.br',
          senha_hash: senhaHash,
          perfil: 'admin_master',
          status: 'ativo'
        })
        .select('id')
        .single();

      if (insertUsrErr) {
        console.error('❌ Erro ao criar admin no Supabase:', insertUsrErr.message);
        return;
      }
      adminId = newUser.id;
      console.log('✅ Admin criado no Supabase:', adminId);
    } else {
      adminId = users[0].id;
    }

    // 2. Verificar Empresa Padrão
    const { data: empresas } = await supabase
      .from('empresas')
      .select('id')
      .eq('cnpj_completo', '19.791.896/0001-00');

    let empresaId: string;

    if (!empresas || empresas.length === 0) {
      const { data: newEmpresa, error: insertEmpErr } = await supabase
        .from('empresas')
        .insert({
          cnpj_raiz: '19791896',
          cnpj_completo: '19.791.896/0001-00',
          razao_social: 'SUPERGASBRAS ENERGIA LTDA',
          nome_fantasia: 'SUPERGASBRAS ENERGIA LTDA',
          uf: 'SP',
          regime_tributario: 'Lucro Real',
          status: 'ativo'
        })
        .select('id')
        .single();

      if (insertEmpErr) {
        console.error('❌ Erro ao criar empresa no Supabase:', insertEmpErr.message);
        return;
      }
      empresaId = newEmpresa.id;
      console.log('✅ Empresa padrão criada no Supabase:', empresaId);
    } else {
      empresaId = empresas[0].id;
    }

    // 3. Vincular Admin à Empresa
    const { data: vinculos } = await supabase
      .from('usuario_empresa')
      .select('id')
      .eq('usuario_id', adminId)
      .eq('empresa_id', empresaId);

    if (!vinculos || vinculos.length === 0) {
      await supabase.from('usuario_empresa').insert({
        usuario_id: adminId,
        empresa_id: empresaId,
        permissao: 'total',
        modulos_permitidos: '*'
      });
      console.log('✅ Vínculo admin <-> empresa criado no Supabase.');
    }

    console.log('✅ Seed do Supabase validado e sincronizado.');
  } catch (err: any) {
    console.error('❌ Falha ao executar seed no Supabase:', err.message);
  }
}
