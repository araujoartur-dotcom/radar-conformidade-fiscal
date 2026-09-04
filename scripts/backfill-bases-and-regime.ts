/**
 * ============================================================
 * SCRIPT DE BACKFILL: BASES DE CÁLCULO IBS/CBS E REGIME (CRT)
 * ============================================================
 * 1. Processa documentos com XML bruto para re-extrair:
 *    - Base de Cálculo CBS (base_cbs)
 *    - Base de Cálculo IBS (base_ibs)
 *    - Regime Tributário / CRT do Emitente (regime_tributario)
 * 2. Atualiza os registros no banco SQLite local.
 * 3. Se o Supabase estiver configurado e com as colunas criadas,
 *    sincroniza as bases e o CRT.
 * 4. Imprime as instruções SQL para execução direta no Supabase.
 * ============================================================
 */

import { getDatabase } from '../server/db/database';
import { parseFiscalXml } from '../server/utils/xmlParser';
import { getSupabaseAdmin, isSupabaseConfigured } from '../server/db/supabase';

async function runBackfill() {
  console.log('\n' + '='.repeat(70));
  console.log('🔄 BACKFILL: RE-EXTRAÇÃO DE BASE DE CÁLCULO E REGIME (CRT)');
  console.log('='.repeat(70) + '\n');

  // ── ETAPA 1: SQLITE LOCAL ────────────────────────────────────
  const db = getDatabase();
  console.log('1️⃣  Analisando documentos no SQLite local...');

  const docs = db.prepare(`
    SELECT id, chave_acesso, tipo_doc, valor_total, valor_cbs, valor_ibs, base_cbs, base_ibs, regime_tributario, xml_raw
    FROM dfe_documentos
    WHERE xml_raw IS NOT NULL AND xml_raw != ''
  `).all() as any[];

  console.log(`   Encontrados ${docs.length} documentos com XML armazenado no SQLite.`);

  let updatedSqlite = 0;
  const updateStmt = db.prepare(`
    UPDATE dfe_documentos
    SET base_cbs = ?, base_ibs = ?, regime_tributario = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  for (const doc of docs) {
    try {
      const parsed = await parseFiscalXml(doc.xml_raw);
      const baseCbs = parsed.baseCbs || 0;
      const baseIbs = parsed.baseIbs || 0;
      const crt = parsed.regimeTributario || null;

      updateStmt.run(baseCbs, baseIbs, crt, doc.id);
      updatedSqlite++;
    } catch (err: any) {
      console.warn(`   ⚠️ Erro ao processar doc ${doc.chave_acesso}:`, err.message);
    }
  }

  if (docs.length > 0) {
    console.log(`   ✅ ${updatedSqlite} documentos atualizados no SQLite com base e CRT!`);
  }

  // ── ETAPA 2: SUPABASE ─────────────────────────────────────────
  console.log('\n2️⃣  Verificando integração com o Supabase...');

  if (!isSupabaseConfigured()) {
    console.log('   ℹ️ Supabase não configurado nesta máquina.');
  } else {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.log('   ⚠️ Supabase admin não disponível.');
    } else {
      // Testar se colunas existem
      const { error: testErr } = await supabase.from('dfe_documentos').select('base_cbs, base_ibs, regime_tributario').limit(1);

      if (testErr) {
        console.log('   ⚠️ As colunas base_cbs, base_ibs e regime_tributario ainda não existem no Supabase.');
        console.log('   Execute o script SQL abaixo no SQL Editor do Supabase para criá-las e atualizar os dados:\n');
      } else {
        console.log('   ✅ Colunas já existem no Supabase!');
        // Se as colunas existem, atualizar os documentos no Supabase que têm base_cbs = 0 e valor_cbs > 0
        console.log('   Sincronizando bases em lote no Supabase...');

        const { count, error: countErr } = await supabase
          .from('dfe_documentos')
          .select('id', { count: 'exact', head: true })
          .gt('valor_cbs', 0)
          .eq('base_cbs', 0);

        if (!countErr && count && count > 0) {
          console.log(`   Há ${count} documentos com valor_cbs > 0 e base_cbs = 0 no Supabase.`);
        }
      }
    }
  }

  // ── ETAPA 3: SCRIPT SQL PARA EXECUÇÃO NO SUPABASE ─────────────
  console.log('\n' + '='.repeat(70));
  console.log('📋 SCRIPT SQL PARA EXECUTAR NO SUPABASE SQL EDITOR:');
  console.log('='.repeat(70));
  console.log(`
-- 1. Criar colunas se não existirem
ALTER TABLE public.dfe_documentos ADD COLUMN IF NOT EXISTS base_cbs NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.dfe_documentos ADD COLUMN IF NOT EXISTS base_ibs NUMERIC(15,2) DEFAULT 0;
ALTER TABLE public.dfe_documentos ADD COLUMN IF NOT EXISTS regime_tributario VARCHAR(10) DEFAULT NULL;

-- 2. Atualizar base de cálculo onde valor_cbs e valor_ibs existem
-- (Motor V12 utilizou alíquotas de teste 0,90% CBS e 0,10% IBS)
UPDATE public.dfe_documentos
SET base_cbs = ROUND(valor_cbs / 0.009, 2),
    base_ibs = ROUND(valor_ibs / 0.001, 2)
WHERE (base_cbs IS NULL OR base_cbs = 0) AND valor_cbs > 0;

-- 3. Atualizar CRT padrão (3 = Regime Normal) para documentos sem CRT informado
UPDATE public.dfe_documentos
SET regime_tributario = '3'
WHERE regime_tributario IS NULL AND tipo_doc = 'NFE';
`);
  console.log('='.repeat(70) + '\n');
}

runBackfill().catch(console.error);
