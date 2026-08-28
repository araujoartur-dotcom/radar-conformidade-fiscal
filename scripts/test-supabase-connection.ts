/**
 * ============================================================
 * AUDITORIA E TESTE DE CONEXÃO / PERSISTÊNCIA SUPABASE
 * ============================================================
 * Executa diagnósticos em tempo real:
 * 1. Validação de isSupabaseConfigured()
 * 2. Checagem de variáveis de ambiente (.env)
 * 3. Teste de conexão HTTP / REST no Supabase Cloud
 * 4. Verificação de existência e integridade de todas as tabelas
 * ============================================================
 */

import { getSupabaseAdmin, isSupabaseConfigured } from '../server/db/supabase';
import { SUPABASE } from '../server/config';

async function runSupabaseAudit() {
  console.log('\n' + '='.repeat(68));
  console.log('🔍 AUDITORIA COMPLETA DE CONEXÃO E PERSISTÊNCIA SUPABASE');
  console.log('='.repeat(68) + '\n');

  // 1. Checagem de isSupabaseConfigured()
  const isConfigured = isSupabaseConfigured();
  console.log(`1️⃣  Status de isSupabaseConfigured(): ${isConfigured ? '✅ TRUE (Configurado)' : '❌ FALSE (Não configurado)'}`);

  // 2. Auditoria das Variáveis de Ambiente
  console.log('\n2️⃣  Variáveis de Ambiente Detectadas:');
  console.log(`   • SUPABASE_URL:             ${SUPABASE.URL ? `✅ Presente (${SUPABASE.URL})` : '❌ Ausente'}`);
  console.log(`   • SUPABASE_ANON_KEY:        ${SUPABASE.ANON_KEY ? `✅ Presente (${SUPABASE.ANON_KEY.substring(0, 16)}...)` : '⚠️ Ausente'}`);
  console.log(`   • SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE.SERVICE_ROLE_KEY ? `✅ Presente (${SUPABASE.SERVICE_ROLE_KEY.substring(0, 16)}...)` : '⚠️ Ausente (Opcional se ANON_KEY existir, mas recomendado)'}`);

  if (!isConfigured) {
    console.log('\n❌ Supabase não está configurado localmente. Adicione SUPABASE_URL e SUPABASE_ANON_KEY no arquivo .env.');
    return;
  }

  // 3. Inicialização do Cliente Supabase
  console.log('\n3️⃣  Testando Conexão com a Nuvem Supabase...');
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.log('❌ Falha ao instanciar cliente Supabase.');
    return;
  }

  // 4. Auditoria Tabela por Tabela do Schema Oficial (supabase_schema.sql)
  console.log('\n4️⃣  Auditoria de Tabelas do Schema Remoto (supabase_schema.sql):');
  
  const tablesToCheck = [
    { name: 'empresas', desc: 'Tenants / Empresas Cadastradas' },
    { name: 'usuarios', desc: 'Usuários e Perfis RBAC' },
    { name: 'usuario_empresa', desc: 'Vínculos Usuário x Empresas' },
    { name: 'dfe_documentos', desc: 'Documentos Fiscais Eletrônicos (NF-e, CT-e, NFS-e)' },
    { name: 'dfe_itens', desc: 'Itens de Documentos Fiscais' },
    { name: 'eventos_transmitidos', desc: 'Eventos SEFAZ / Manifestações de Terceiros' },
    { name: 'aliquotas_referencia', desc: 'Cronograma Oficial Alíquotas RTC' },
    { name: 'aliquotas_tabelas', desc: 'Tabela de Alíquotas Dinâmicas (Ad Valorem / Ad Rem)' },
    { name: 'ncm_regras_anexos', desc: 'Regras de Anexos NCM / NBS / cClassTrib' },
    { name: 'cclasstrib_regras', desc: 'Regras Oficiais cClassTrib' },
    { name: 'cfop_tratamento', desc: 'Tratamento Padrão de CFOPs' },
    { name: 'auditoria_regras', desc: 'Regras Automatizadas de Auditoria' },
    { name: 'auditoria_historico', desc: 'Logs de Auditoria Fiscal' },
  ];

  let existingCount = 0;
  let missingCount = 0;
  const issues: string[] = [];

  for (const t of tablesToCheck) {
    try {
      const { data, error, count } = await supabase
        .from(t.name)
        .select('*', { count: 'exact', head: true });

      if (error) {
        if (error.code === '42P01' || error.message.includes('relation') || error.message.includes('does not exist')) {
          console.log(`   ❌ [AUSENTE]  ${t.name.padEnd(24)} — Tabela NÃO existe no Supabase.`);
          missingCount++;
          issues.push(`Tabela "${t.name}" não existe no banco de dados.`);
        } else {
          console.log(`   ⚠️ [ERRO/COL] ${t.name.padEnd(24)} — ${error.message}`);
          issues.push(`Tabela "${t.name}": ${error.message}`);
        }
      } else {
        // Query de contagem rápida
        const { count: rowCount } = await supabase.from(t.name).select('*', { count: 'exact', head: true });
        console.log(`   ✅ [EXISTE]   ${t.name.padEnd(24)} — ${t.desc} (${rowCount ?? 0} registros)`);
        existingCount++;
      }
    } catch (err: any) {
      console.log(`   ❌ [FALHA]    ${t.name.padEnd(24)} — ${err.message}`);
      missingCount++;
    }
  }

  // 5. Teste de SELECT Simples
  console.log('\n5️⃣  Executando Teste de SELECT Simples em dfe_documentos:');
  try {
    const { data: docs, error: docErr } = await supabase
      .from('dfe_documentos')
      .select('id, chave_acesso, tipo_doc, fornecedor_cnpj, cliente_cnpj, valor_total')
      .limit(3);

    if (docErr) {
      console.log(`   ⚠️ Erro ao consultar dfe_documentos: ${docErr.message}`);
    } else {
      console.log(`   ✅ SELECT executado com sucesso!`);
      console.log(`   📊 Registros retornados (${docs.length}):`);
      if (docs.length === 0) {
        console.log('      (Nenhum documento cadastrado no Supabase ainda - pronto para receber ingestão)');
      } else {
        docs.forEach((d, i) => {
          console.log(`      [${i + 1}] Tipo: ${d.tipo_doc} | Chave: ${d.chave_acesso} | Total: R$ ${d.valor_total}`);
        });
      }
    }
  } catch (e: any) {
    console.log(`   ❌ Falha no SELECT: ${e.message}`);
  }

  // 6. Resumo e Diagnóstico Final
  console.log('\n' + '='.repeat(68));
  console.log('📋 RESUMO E RECOMENDAÇÃO:');
  console.log(`   • Tabelas Prontas:   ${existingCount} de ${tablesToCheck.length}`);
  console.log(`   • Tabelas Pendentes: ${missingCount}`);
  
  if (missingCount > 0) {
    console.log('\n⚠️  AÇÃO REQUERIDA:');
    console.log('   Algumas tabelas do schema ainda não foram criadas no Supabase.');
    console.log('   Para criá-las com 1 clique:');
    console.log('   1. Abra o painel do Supabase (https://supabase.com/dashboard)');
    console.log('   2. Acesse seu projeto e clique no menu "SQL Editor"');
    console.log('   3. Copie todo o conteúdo do arquivo:');
    console.log('      server/db/supabase_schema.sql');
    console.log('   4. Cole no SQL Editor e clique em "RUN".');
  } else {
    console.log('\n🎉 PERFEITO! Todas as tabelas do schema existem e estão operacionais.');
  }
  console.log('='.repeat(68) + '\n');
}

runSupabaseAudit().catch(console.error);
