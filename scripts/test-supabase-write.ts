/**
 * ============================================================
 * TESTE DE ESCRITA REAL NO SUPABASE
 * ============================================================
 * Insere um documento de teste real no Supabase e verifica se persiste.
 * Depois tenta ler de volta.
 * ============================================================
 */

import { getSupabaseAdmin, isSupabaseConfigured } from '../server/db/supabase';
import { v4 as uuidv4 } from 'uuid';

async function testSupabaseWrite() {
  console.log('\n' + '='.repeat(68));
  console.log('✏️  TESTE DE ESCRITA REAL NO SUPABASE');
  console.log('='.repeat(68) + '\n');

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.log('❌ Falha ao criar cliente Supabase.');
    return;
  }

  // Buscar uma empresa válida no Supabase
  const { data: empresas, error: empErr } = await supabase.from('empresas').select('id').limit(1);
  let empresaIdValida = '';
  
  if (empresas && empresas.length > 0) {
    empresaIdValida = empresas[0].id;
  } else {
    // Inserir empresa de teste
    empresaIdValida = uuidv4();
    await supabase.from('empresas').insert({
      id: empresaIdValida,
      cnpj_raiz: '99999999',
      cnpj_completo: '99999999000199',
      razao_social: 'EMPRESA TESTE SUPABASE',
      uf: 'SP',
      regime_tributario: 'Lucro Real'
    });
  }

  const testId = `test-write-${uuidv4().substring(0, 8)}`;
  const testChave = `99999900000000000000550010000000011000000001`;
  const now = new Date().toISOString();

  console.log('1️⃣  Tentando INSERT de teste em dfe_documentos...');
  console.log(`   ID: ${testId}`);
  console.log(`   Chave: ${testChave}`);
  console.log(`   Empresa ID usada: ${empresaIdValida}`);

  const { data: insertData, error: insertErr } = await supabase.from('dfe_documentos').upsert({
    id: testId,
    empresa_id: empresaIdValida,
    tipo_doc: 'NFe',
    chave_acesso: testChave,
    tipo_operacao: 'Entrada',
    numero_serie: '000000001 / 001',
    data_emissao: '2026-08-27',
    data_entrada: now,
    competencia: '2026-08',
    fornecedor_cnpj: '11111111000111',
    fornecedor_razao: 'FORNECEDOR TESTE SUPABASE',
    fornecedor_uf: 'SP',
    cliente_cnpj: '19791896000100',
    cliente_razao: 'SUPERGASBRAS ENERGIA LTDA',
    cliente_uf: 'SP',
    situacao_doc: 'autorizado',
    situacao_manifestacao: 'sem_manifestacao',
    evento_ultimo: 'Teste de Persistência',
    valor_total: 1500.50,
    valor_cbs: 132.04,
    valor_ibs: 265.59,
    xml_raw: '<nfeProc><teste>teste_de_escrita_supabase</teste></nfeProc>',
    download_at: now,
    updated_at: now
  }, { onConflict: 'chave_acesso' });

  if (insertErr) {
    console.log(`\n   ❌ ERRO NO UPSERT: ${insertErr.message}`);
    console.log(`   Código: ${insertErr.code}`);
    console.log(`   Detalhes: ${insertErr.details}`);
    console.log(`   Hint: ${insertErr.hint}`);
    console.log('\n   🔍 POSSÍVEIS CAUSAS:');
    console.log('   - RLS (Row Level Security) habilitado sem policy para service_role');
    console.log('   - Coluna obrigatória faltando no schema');
    console.log('   - Constraint de tipo ou tamanho violada');
    return;
  }

  console.log('   ✅ UPSERT realizado com sucesso! insertData:', JSON.stringify(insertData));

  // 2. Ler de volta
  console.log('\n2️⃣  Tentando SELECT do documento inserido...');
  const { data: readData, error: readErr } = await supabase
    .from('dfe_documentos')
    .select('id, chave_acesso, tipo_doc, valor_total, fornecedor_razao, cliente_razao')
    .eq('chave_acesso', testChave)
    .single();

  if (readErr) {
    console.log(`   ❌ ERRO NO SELECT: ${readErr.message}`);
    return;
  }

  console.log('   ✅ SELECT retornou com sucesso!');
  console.log(`   ID: ${readData.id}`);
  console.log(`   Chave: ${readData.chave_acesso}`);
  console.log(`   Tipo: ${readData.tipo_doc}`);
  console.log(`   Valor: R$ ${readData.valor_total}`);
  console.log(`   Fornecedor: ${readData.fornecedor_razao}`);
  console.log(`   Cliente: ${readData.cliente_razao}`);

  // 3. Contar total agora
  const { count } = await supabase.from('dfe_documentos').select('*', { count: 'exact', head: true });
  console.log(`\n3️⃣  Total de documentos no Supabase agora: ${count}`);

  // 4. Limpar o documento de teste
  console.log('\n4️⃣  Limpando documento de teste...');
  const { error: deleteErr } = await supabase.from('dfe_documentos').delete().eq('id', testId);
  if (deleteErr) {
    console.log(`   ⚠️ Erro ao deletar teste: ${deleteErr.message}`);
  } else {
    console.log('   ✅ Documento de teste removido com sucesso.');
  }

  console.log('\n' + '='.repeat(68));
  console.log('🎉 RESULTADO: Escrita e leitura no Supabase funcionando perfeitamente!');
  console.log('='.repeat(68) + '\n');
}

testSupabaseWrite().catch(console.error);
