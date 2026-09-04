/**
 * ============================================================
 * MIGRATION: GARANTIR COLUNAS FALTANTES NO SUPABASE
 * ============================================================
 * Verifica e adiciona colunas que existem no schema DDL
 * mas podem estar ausentes no banco remoto Supabase.
 * ============================================================
 */

import { getSupabaseAdmin, isSupabaseConfigured } from '../server/db/supabase';

async function migrateSupabaseColumns() {
  console.log('\n' + '='.repeat(68));
  console.log('🔧 MIGRATION: VERIFICAÇÃO E ADIÇÃO DE COLUNAS NO SUPABASE');
  console.log('='.repeat(68) + '\n');

  if (!isSupabaseConfigured()) {
    console.log('❌ Supabase não configurado.');
    return;
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.log('❌ Falha ao criar cliente.');
    return;
  }

  // Verificar quais colunas existem na tabela dfe_documentos
  console.log('1️⃣  Verificando colunas existentes em dfe_documentos...');

  // Tentar um select com todas as colunas esperadas para ver quais existem
  const colunasEsperadas = [
    'id', 'empresa_id', 'tipo_doc', 'chave_acesso', 'tipo_operacao', 'numero_serie',
    'data_emissao', 'data_entrada', 'competencia',
    'fornecedor_cnpj', 'fornecedor_razao', 'fornecedor_uf', 'fornecedor_municipio', 'fornecedor_ie',
    'cliente_cnpj', 'cliente_razao', 'cliente_uf', 'cliente_ie',
    'situacao_doc', 'situacao_manifestacao', 'evento_ultimo',
    'valor_total', 'valor_icms', 'valor_ipi', 'valor_pis', 'valor_cofins',
    'valor_cbs', 'valor_ibs', 'base_cbs', 'base_ibs', 'regime_tributario',
    'valor_is', 'valor_irrf', 'valor_inss', 'valor_iss', 'valor_csll',
    'xml_raw', 'status_sefaz', 'protocolo_sefaz', 'alerta_fraude',
    'download_at', 'created_at', 'updated_at'
  ];

  const missing: string[] = [];
  for (const col of colunasEsperadas) {
    const { error } = await supabase.from('dfe_documentos').select(col).limit(0);
    if (error && (error.message.includes('column') || error.message.includes('schema cache') || error.code === 'PGRST204')) {
      missing.push(col);
      console.log(`   ❌ Coluna "${col}" NÃO ENCONTRADA no schema cache`);
    } else {
      // console.log(`   ✅ ${col}`);
    }
  }

  if (missing.length === 0) {
    console.log('   ✅ Todas as colunas esperadas existem!');
  } else {
    console.log(`\n   🚨 ${missing.length} coluna(s) faltando: ${missing.join(', ')}`);
    console.log('\n   Para corrigir, execute o seguinte SQL no SQL Editor do Supabase:');
    console.log('   ──────────────────────────────────────────');
    
    const columnDefs: Record<string, string> = {
      'base_cbs': 'NUMERIC(15,2) DEFAULT 0',
      'base_ibs': 'NUMERIC(15,2) DEFAULT 0',
      'regime_tributario': 'VARCHAR(10) DEFAULT NULL',
      'download_at': 'TIMESTAMPTZ DEFAULT NULL',
      'alerta_fraude': 'BOOLEAN DEFAULT FALSE',
      'fornecedor_municipio': "VARCHAR(100) DEFAULT ''",
      'fornecedor_ie': "VARCHAR(30) DEFAULT ''",
      'cliente_ie': "VARCHAR(30) DEFAULT ''",
      'status_sefaz': "VARCHAR(30) DEFAULT 'autorizado'",
      'protocolo_sefaz': "VARCHAR(50) DEFAULT ''",
      'valor_irrf': 'NUMERIC(15,2) DEFAULT 0',
      'valor_inss': 'NUMERIC(15,2) DEFAULT 0',
      'valor_iss': 'NUMERIC(15,2) DEFAULT 0',
      'valor_csll': 'NUMERIC(15,2) DEFAULT 0',
      'valor_is': 'NUMERIC(15,2) DEFAULT 0',
    };

    for (const col of missing) {
      const def = columnDefs[col] || 'TEXT DEFAULT NULL';
      console.log(`   ALTER TABLE public.dfe_documentos ADD COLUMN IF NOT EXISTS ${col} ${def};`);
    }
    console.log('   ──────────────────────────────────────────');

    // Tentar executar via RPC
    console.log('\n2️⃣  Tentando adicionar colunas automaticamente via RPC...');
    for (const col of missing) {
      const def = columnDefs[col] || 'TEXT DEFAULT NULL';
      const sql = `ALTER TABLE public.dfe_documentos ADD COLUMN IF NOT EXISTS ${col} ${def};`;
      try {
        const { error: rpcErr } = await supabase.rpc('exec_sql', { sql_query: sql });
        if (rpcErr) {
          console.log(`   ⚠️ RPC não disponível para "${col}": ${rpcErr.message}`);
          console.log('   → Você precisará executar o ALTER TABLE manualmente no SQL Editor do Supabase.');
          break;
        } else {
          console.log(`   ✅ Coluna "${col}" adicionada com sucesso!`);
        }
      } catch (e: any) {
        console.log(`   ⚠️ Erro ao adicionar "${col}": ${e.message}`);
        console.log('   → Você precisará executar o ALTER TABLE manualmente no SQL Editor do Supabase.');
        break;
      }
    }
  }

  // Verificar dfe_itens também
  console.log('\n3️⃣  Verificando colunas em dfe_itens...');
  const itensColsEsperadas = [
    'id', 'documento_id', 'item_nro', 'codigo_item', 'descricao_item', 'ncm', 'cest', 'cfop',
    'cclasstrib', 'cst_csosn', 'natureza_operacao', 'quantidade', 'unidade',
    'valor_unitario', 'valor_bruto_item', 'desconto_incondicional', 'frete_seguro_rateado',
    'valor_liquido_item', 'base_icms', 'aliquota_icms', 'valor_icms',
    'base_ipi', 'aliquota_ipi', 'valor_ipi',
    'base_pis', 'aliquota_pis', 'valor_pis',
    'base_cofins', 'aliquota_cofins', 'valor_cofins',
    'base_ibs', 'aliquota_ibs', 'valor_ibs',
    'base_cbs', 'aliquota_cbs', 'valor_cbs', 'valor_is', 'created_at'
  ];

  const missingItens: string[] = [];
  for (const col of itensColsEsperadas) {
    const { error } = await supabase.from('dfe_itens').select(col).limit(0);
    if (error && (error.message.includes('column') || error.message.includes('schema cache') || error.code === 'PGRST204')) {
      missingItens.push(col);
      console.log(`   ❌ Coluna "${col}" NÃO ENCONTRADA`);
    }
  }

  if (missingItens.length === 0) {
    console.log('   ✅ Todas as colunas de dfe_itens existem!');
  }

  console.log('\n' + '='.repeat(68));
  console.log('📋 RESUMO:');
  console.log(`   dfe_documentos: ${missing.length} colunas faltando`);
  console.log(`   dfe_itens: ${missingItens.length} colunas faltando`);
  
  if (missing.length > 0) {
    console.log('\n⚠️  AÇÃO NECESSÁRIA:');
    console.log('   Abra o SQL Editor do Supabase e execute os ALTER TABLE acima.');
    console.log('   Depois, execute: NOTIFY pgrst, \'reload schema\';');
    console.log('   Isso recarrega o cache do PostgREST e permite o upsert funcionar.');
  }
  console.log('='.repeat(68) + '\n');
}

migrateSupabaseColumns().catch(console.error);
