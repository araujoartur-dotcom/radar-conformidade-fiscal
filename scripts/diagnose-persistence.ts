/**
 * ============================================================
 * DIAGNÓSTICO FORENSE: POR QUE OS DOCUMENTOS NÃO PERSISTEM?
 * ============================================================
 * Rastreia toda a cadeia de persistência para encontrar a falha exata.
 * ============================================================
 */

import { getDatabase } from '../server/db/database';
import { getSupabaseAdmin, isSupabaseConfigured } from '../server/db/supabase';

async function runDiagnostic() {
  console.log('\n' + '='.repeat(72));
  console.log('🔬 DIAGNÓSTICO FORENSE: CADEIA DE PERSISTÊNCIA DE DOCUMENTOS FISCAIS');
  console.log('='.repeat(72) + '\n');

  // ── 1. VERIFICAR SQLite LOCAL ──
  console.log('1️⃣  BANCO LOCAL (SQLite): ./data/radar_fiscal.db\n');
  
  const db = getDatabase();

  // Tabela dfe_documentos existe?
  const tableInfo = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='dfe_documentos'").get();
  console.log(`   Tabela dfe_documentos existe? ${tableInfo ? '✅ SIM' : '❌ NÃO'}`);

  if (!tableInfo) {
    console.log('\n❌ FALHA CRÍTICA: A tabela dfe_documentos NÃO existe no SQLite local!');
    console.log('   Ação: Rode "npm start" para inicializar o schema automaticamente.');
    return;
  }

  // Quantos documentos existem?
  const countResult = db.prepare('SELECT COUNT(*) as total FROM dfe_documentos').get() as any;
  const totalDocs = countResult?.total || 0;
  console.log(`   Total de documentos no SQLite local: ${totalDocs}`);

  if (totalDocs > 0) {
    // Listar os últimos 5 documentos
    const recentDocs = db.prepare(`
      SELECT id, chave_acesso, tipo_doc, tipo_operacao, empresa_id, 
             fornecedor_cnpj, cliente_cnpj, valor_total, data_emissao, created_at, download_at
      FROM dfe_documentos 
      ORDER BY created_at DESC 
      LIMIT 5
    `).all() as any[];

    console.log('\n   📋 Últimos 5 documentos gravados:');
    recentDocs.forEach((d, i) => {
      console.log(`   [${i+1}] ID: ${d.id}`);
      console.log(`       Chave: ${d.chave_acesso}`);
      console.log(`       Tipo: ${d.tipo_doc} | Op: ${d.tipo_operacao}`);
      console.log(`       empresa_id: ${d.empresa_id || '⚠️ NULO/VAZIO'}`);
      console.log(`       Fornecedor: ${d.fornecedor_cnpj || 'VAZIO'} | Cliente: ${d.cliente_cnpj || 'VAZIO'}`);
      console.log(`       Valor: R$ ${d.valor_total} | Emissão: ${d.data_emissao}`);
      console.log(`       Criado em: ${d.created_at} | Download: ${d.download_at}`);
      console.log('');
    });
  }

  // Quantos itens?
  const countItens = db.prepare('SELECT COUNT(*) as total FROM dfe_itens').get() as any;
  console.log(`   Total de itens (dfe_itens) no SQLite local: ${countItens?.total || 0}`);

  // Quantos eventos?
  const countEventos = db.prepare('SELECT COUNT(*) as total FROM eventos_transmitidos').get() as any;
  console.log(`   Total de eventos_transmitidos: ${countEventos?.total || 0}`);

  // ── 2. VERIFICAR EMPRESAS EXISTENTES ──
  console.log('\n2️⃣  EMPRESAS CADASTRADAS (empresas):');
  const empresas = db.prepare('SELECT id, cnpj_completo, cnpj_raiz, razao_social, status FROM empresas').all() as any[];
  if (empresas.length === 0) {
    console.log('   ⚠️ Nenhuma empresa cadastrada no banco local!');
  } else {
    empresas.forEach((e, i) => {
      console.log(`   [${i+1}] ID: ${e.id} | CNPJ: ${e.cnpj_completo} | Razão: ${e.razao_social} | Status: ${e.status}`);
    });
  }

  // ── 3. VERIFICAR USUÁRIOS E VÍNCULOS ──
  console.log('\n3️⃣  USUÁRIOS E VÍNCULOS (usuarios + usuario_empresa):');
  const usuarios = db.prepare('SELECT id, nome, email, perfil, empresa_ativa_id FROM usuarios').all() as any[];
  if (usuarios.length === 0) {
    console.log('   ⚠️ Nenhum usuário cadastrado!');
  } else {
    for (const u of usuarios) {
      const vinculos = db.prepare('SELECT empresa_id FROM usuario_empresa WHERE usuario_id = ?').all(u.id) as any[];
      console.log(`   Usuário: ${u.nome} (${u.email}) | Perfil: ${u.perfil}`);
      console.log(`   Empresa Ativa: ${u.empresa_ativa_id || '⚠️ NENHUMA'}`);
      console.log(`   Vínculos: ${vinculos.length > 0 ? vinculos.map(v => v.empresa_id).join(', ') : '⚠️ NENHUM VÍNCULO'}`);
      
      // Verificar se empresa_ativa_id realmente existe na tabela empresas
      if (u.empresa_ativa_id) {
        const empCheck = db.prepare('SELECT id, cnpj_completo FROM empresas WHERE id = ?').get(u.empresa_ativa_id) as any;
        if (empCheck) {
          console.log(`   Empresa Ativa Verificada: ✅ ${empCheck.cnpj_completo}`);
        } else {
          console.log(`   ⚠️ EMPRESA ATIVA ID "${u.empresa_ativa_id}" NÃO ENCONTRADA NA TABELA empresas!`);
        }
      }
    }
  }

  // ── 4. SIMULAR O FILTRO DO GET /documentos ──
  console.log('\n4️⃣  SIMULAÇÃO DO FILTRO GET /api/upload/documentos:');
  if (usuarios.length > 0 && empresas.length > 0) {
    const user = usuarios[0];
    const activeEmpId = user.empresa_ativa_id;
    
    if (!activeEmpId) {
      console.log('   ⚠️ Usuário NÃO TEM empresa_ativa_id — o GET /documentos vai falhar silenciosamente!');
    } else {
      const empRow = db.prepare('SELECT cnpj_completo FROM empresas WHERE id = ?').get(activeEmpId) as any;
      const tenantCnpj = empRow?.cnpj_completo?.replace(/\D/g, '') || '';
      
      console.log(`   empresa_ativa_id: ${activeEmpId}`);
      console.log(`   CNPJ limpo do tenant: ${tenantCnpj}`);
      
      // Query idêntica à do endpoint GET /documentos
      const queryResult = db.prepare(`
        SELECT COUNT(*) as total
        FROM dfe_documentos d
        LEFT JOIN empresas e ON e.id = d.empresa_id
        WHERE (
          d.empresa_id = ?
          OR d.empresa_id IN (SELECT empresa_id FROM usuario_empresa WHERE usuario_id = ?)
          OR d.cliente_cnpj LIKE ?
          OR d.fornecedor_cnpj LIKE ?
        )
      `).get(activeEmpId, user.id, `%${tenantCnpj}%`, `%${tenantCnpj}%`) as any;

      console.log(`   Documentos retornados com esse filtro: ${queryResult?.total || 0}`);
      
      if (queryResult?.total === 0 && totalDocs > 0) {
        console.log('\n   🚨 DIVERGÊNCIA DETECTADA!');
        console.log(`   Existem ${totalDocs} documentos no banco, mas o filtro retorna 0.`);
        console.log('   Isso significa que o empresa_id dos documentos NÃO bate com o empresa_ativa_id do usuário.');
        
        // Descobrir quais empresa_ids estão nos documentos
        const docEmpIds = db.prepare('SELECT DISTINCT empresa_id FROM dfe_documentos').all() as any[];
        console.log(`   empresa_ids nos documentos: ${docEmpIds.map(d => `"${d.empresa_id}"`).join(', ')}`);
        console.log(`   empresa_ativa_id do usuário: "${activeEmpId}"`);
      }
    }
  }

  // ── 5. VERIFICAR SUPABASE ──
  console.log('\n5️⃣  BANCO REMOTO (Supabase Cloud):');
  if (!isSupabaseConfigured()) {
    console.log('   ⚠️ Supabase não configurado.');
  } else {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { count: supaDocCount } = await supabase.from('dfe_documentos').select('*', { count: 'exact', head: true });
      console.log(`   Documentos no Supabase: ${supaDocCount ?? 0}`);
      
      const { count: supaItemCount } = await supabase.from('dfe_itens').select('*', { count: 'exact', head: true });
      console.log(`   Itens no Supabase: ${supaItemCount ?? 0}`);
      
      if ((supaDocCount ?? 0) === 0 && totalDocs > 0) {
        console.log('\n   🚨 DOCUMENTOS EXISTEM NO SQLite MAS NÃO NO SUPABASE!');
        console.log('   Possível causa: o upsert no Supabase está falhando silenciosamente.');
      }
    }
  }

  // ── 6. DIAGNÓSTICO FINAL ──
  console.log('\n' + '='.repeat(72));
  console.log('📋 DIAGNÓSTICO FINAL:');
  
  if (totalDocs === 0) {
    console.log('\n   ❌ PROBLEMA CONFIRMADO: 0 documentos no SQLite local E 0 no Supabase.');
    console.log('   Isso significa que NENHUMA das vias de ingestão (SEFAZ, Upload, Consulta por Chave)');
    console.log('   está efetivamente gravando no banco de dados.');
    console.log('\n   POSSÍVEIS CAUSAS:');
    console.log('   A) O SQLite do Render é EFÊMERO (disco descartável). Toda vez que o');
    console.log('      container do Render reinicia ou faz deploy, o SQLite é apagado.');
    console.log('      SOLUÇÃO: Usar SOMENTE o Supabase como fonte primária de dados.');
    console.log('   B) O frontend está acessando o backend de produção (Render), mas o Render');
    console.log('      pode reiniciar o container a qualquer momento, perdendo o SQLite.');
    console.log('   C) O Supabase não está recebendo os dados — o upsert pode estar falhando');
    console.log('      silenciosamente por causa de RLS (Row Level Security) ou colunas faltando.');
  } else {
    console.log(`\n   ✅ ${totalDocs} documento(s) encontrados no SQLite.`);
    console.log('   Se eles desaparecem no frontend, o problema é no filtro de tenant.');
  }

  console.log('='.repeat(72) + '\n');
}

runDiagnostic().catch(console.error);
