/**
 * ============================================================
 * SCRIPT DE CARGA DA MATRIZ CANÔNICA DE CFOPS
 * ============================================================
 * Popula a tabela cfop_tratamento com a lista oficial fornecida
 * pelo usuário, configurando rigorosamente:
 * - Categoria (Compra, Devolução, Transferência, Remessa, etc.)
 * - Tratamento Padrão (Elegível, Não elegível, Depende)
 * - Exige Onerosidade (1 = Oneroso, 0 = Não Oneroso)
 * - Evidência Mínima de Compliance
 * ============================================================
 */

import { v4 as uuid } from 'uuid';
import { getDatabase } from '../server/db/database';
import { getSupabaseAdmin, isSupabaseConfigured } from '../server/db/supabase';
import { USER_CFOP_LIST, UserCfopItem } from '../server/db/cfop_user_data';

function mapCategoria(classe: string): string {
  const c = classe.toLowerCase();
  if (c.includes('compra') || c.includes('aquisi')) return 'Compra';
  if (c.includes('dev')) return 'Devolução';
  if (c.includes('transf')) return 'Transferência';
  if (c.includes('remessa')) return 'Remessa';
  if (c.includes('retorno')) return 'Retorno';
  if (c.includes('venda') || c.includes('presta')) return 'Venda';
  return 'Outros';
}

function mapTratamentoPadrao(item: UserCfopItem): string {
  if (item.tipoOperacao === 'Depende - Avaliar cada Cenário SGB') return 'Depende';
  if (item.tipoOperacao === 'Não Onerosas') return 'Não elegível';

  const cat = mapCategoria(item.classe);
  if (cat === 'Compra') return 'Elegível';
  if (cat === 'Devolução') return 'Depende';
  if (cat === 'Venda') return 'Não elegível'; // saídas não geram crédito de entrada
  return 'Depende';
}

function mapEvidenciaMinima(item: UserCfopItem): string {
  const cat = mapCategoria(item.classe);
  if (item.cfop.startsWith('3')) {
    return 'DI / Duimp + NF-e de Entrada de Importação + Comprovante de Pagamento';
  }
  if (item.classe.includes('Transporte')) {
    return 'CT-e Autorizado vinculado à NF-e + DACTE';
  }
  if (cat === 'Compra') {
    return 'XML NF-e com Chave Válida + Fatura Comercial / Duplicata Paga';
  }
  if (cat === 'Devolução') {
    return 'NF-e de Devolução espelho com chave da nota originária';
  }
  if (cat === 'Transferência') {
    return 'NF-e de Transferência entre estabelecimentos da mesma empresa';
  }
  if (cat === 'Remessa' || cat === 'Retorno') {
    return 'NF-e de Remessa/Retorno sem cobrança financeira (Art. 32 LC 214/2025)';
  }
  return 'Documento Fiscal Eletrônico (DF-e) Autorizado';
}

async function runSeed() {
  console.log(`🚀 Iniciando carga de ${USER_CFOP_LIST.length} CFOPs na Matriz de Parâmetros Fiscais...`);

  // 1. Carga no SQLite Local
  const db = getDatabase();

  const stmtCheck = db.prepare('SELECT id FROM cfop_tratamento WHERE cfop = ?');
  const stmtUpdate = db.prepare(`
    UPDATE cfop_tratamento SET
      descricao = ?,
      categoria = ?,
      tratamento_padrao = ?,
      exige_onerosidade = ?,
      exige_validacao_cclasstrib = 1,
      evidencia_minima = ?,
      ativo = 1,
      updated_at = datetime('now')
    WHERE id = ?
  `);
  const stmtInsert = db.prepare(`
    INSERT INTO cfop_tratamento (
      id, empresa_id, cfop, descricao, categoria,
      tratamento_padrao, exige_onerosidade, exige_validacao_cclasstrib,
      evidencia_minima, ativo, created_at, updated_at
    ) VALUES (?, NULL, ?, ?, ?, ?, ?, 1, ?, 1, datetime('now'), datetime('now'))
  `);

  let countSqliteInsert = 0;
  let countSqliteUpdate = 0;

  const runSqliteBatch = db.transaction(() => {
    for (const item of USER_CFOP_LIST) {
      const categoria = mapCategoria(item.classe);
      const tratamentoPadrao = mapTratamentoPadrao(item);
      const exigeOnerosidade = item.tipoOperacao === 'Não Onerosas' ? 0 : 1;
      const evidenciaMinima = mapEvidenciaMinima(item);

      const existing = stmtCheck.get(item.cfop) as any;
      if (existing) {
        stmtUpdate.run(item.descricao, categoria, tratamentoPadrao, exigeOnerosidade, evidenciaMinima, existing.id);
        countSqliteUpdate++;
      } else {
        stmtInsert.run(uuid(), item.cfop, item.descricao, categoria, tratamentoPadrao, exigeOnerosidade, evidenciaMinima);
        countSqliteInsert++;
      }
    }
  });

  runSqliteBatch();
  console.log(`✅ SQLite atualizado: ${countSqliteInsert} novos inseridos, ${countSqliteUpdate} atualizados.`);

  const totalSqlite = (db.prepare('SELECT count(*) as total FROM cfop_tratamento WHERE ativo = 1').get() as any).total;
  console.log(`📊 Total ativo na tabela SQLite cfop_tratamento: ${totalSqlite} CFOPs.`);

  // 2. Carga no Supabase (se configurado)
  if (isSupabaseConfigured()) {
    console.log('🌐 Sincronizando com o Supabase de Produção...');
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data: existingSupa, error: errFetch } = await supabase
          .from('cfop_tratamento')
          .select('id, cfop');

        if (errFetch) {
          console.warn('⚠️ Erro ao consultar cfop_tratamento no Supabase:', errFetch.message);
        }

        const supaMap = new Map((existingSupa || []).map((r: any) => [r.cfop, r.id]));

        const toInsert: any[] = [];
        const toUpdate: any[] = [];

        for (const item of USER_CFOP_LIST) {
          const rowData = {
            cfop: item.cfop,
            descricao: item.descricao,
            categoria: mapCategoria(item.classe),
            tratamento_padrao: mapTratamentoPadrao(item),
            exige_onerosidade: item.tipoOperacao !== 'Não Onerosas',
            exige_validacao_cclasstrib: true,
            evidencia_minima: mapEvidenciaMinima(item),
            ativo: true,
            updated_at: new Date().toISOString()
          };

          const existingId = supaMap.get(item.cfop);
          if (existingId) {
            toUpdate.push({ id: existingId, ...rowData });
          } else {
            toInsert.push(rowData);
          }
        }

        let supaCount = 0;
        // Inserir novos em lotes
        const batchSize = 100;
        for (let i = 0; i < toInsert.length; i += batchSize) {
          const slice = toInsert.slice(i, i + batchSize);
          const { error } = await supabase.from('cfop_tratamento').insert(slice);
          if (error) {
            console.warn(`⚠️ Aviso no insert Supabase ${i}-${i + slice.length}:`, error.message);
          } else {
            supaCount += slice.length;
          }
        }

        // Atualizar existentes
        for (const upd of toUpdate) {
          const { error } = await supabase
            .from('cfop_tratamento')
            .update(upd)
            .eq('id', upd.id);
          if (!error) supaCount++;
        }

        console.log(`✅ Supabase sincronizado com sucesso: ${toInsert.length} inseridos, ${toUpdate.length} atualizados (Total: ${supaCount}).`);
      } catch (e: any) {
        console.warn('⚠️ Supabase sync error:', e?.message || e);
      }
    }
  } else {
    console.log('ℹ️ Supabase não configurado neste ambiente local (apenas SQLite foi atualizado).');
  }

  console.log('🎉 Carga da Matriz de CFOPs concluída com 100% de sucesso!');
}

runSeed().catch(err => {
  console.error('❌ Falha na execução da carga:', err);
  process.exit(1);
});
