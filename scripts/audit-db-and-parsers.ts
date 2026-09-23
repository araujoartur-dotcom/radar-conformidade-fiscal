import { getSupabaseAdmin, isSupabaseConfigured } from '../server/db/supabase';
import { getDatabase } from '../server/db/database';
import { parseFiscalXml } from '../server/utils/xmlParser';

async function runAudit() {
  console.log('='.repeat(70));
  console.log('🔍 AUDITORIA DE INTEGRIDADE FISCAL: DADOS REAIS vs INFERÊNCIAS');
  console.log('='.repeat(70));

  if (!isSupabaseConfigured()) {
    console.log('Supabase não configurado');
    return;
  }
  const supa = getSupabaseAdmin()!;

  // 1. Verificar contagem de itens em dfe_itens
  const { count: totalItens } = await supa.from('dfe_itens').select('*', { count: 'exact', head: true });
  console.log('Total de registros em dfe_itens:', totalItens);

  // 2. Quantos itens têm base_ibs > 0 e valor_ibs == 0?
  const { count: baseSemImposto } = await supa.from('dfe_itens').select('*', { count: 'exact', head: true }).gt('base_ibs', 0).eq('valor_ibs', 0);
  console.log('Itens com base_ibs > 0 E valor_ibs == 0:', baseSemImposto);

  // 3. Quantos itens têm cclasstrib = '000001'?
  const { count: cclassPadrao } = await supa.from('dfe_itens').select('*', { count: 'exact', head: true }).eq('cclasstrib', '000001');
  console.log("Itens com cclasstrib = '000001':", cclassPadrao);

  // 4. Quantos documentos em dfe_documentos têm a tag <IBSCBS> no xml_raw?
  // Consultar uma amostra de documentos para comparar XML real vs banco
  const { data: docsAmostra } = await supa.from('dfe_documentos').select('id, chave_acesso, valor_total, valor_ibs, valor_cbs, base_ibs, base_cbs, xml_raw').limit(100);

  let docsComTagIbs = 0;
  let docsSemTagIbsMasComBase = 0;
  let docsDivergentes = 0;

  for (const doc of (docsAmostra || [])) {
    if (!doc.xml_raw) continue;
    const temIbsXml = doc.xml_raw.includes('<IBSCBS>') || doc.xml_raw.includes('<gIBSCBS>') || doc.xml_raw.includes('<vIBS>');
    if (temIbsXml) docsComTagIbs++;
    if (!temIbsXml && (Number(doc.base_ibs) > 0 || Number(doc.valor_ibs) > 0)) {
      docsSemTagIbsMasComBase++;
    }
  }

  console.log('Amostra de 100 documentos:');
  console.log('  - Documentos com tag <IBSCBS> no XML:', docsComTagIbs);
  console.log('  - Documentos SEM tag <IBSCBS> no XML mas com base/valor no banco:', docsSemTagIbsMasComBase);

  // 5. Verificar dfe_itens de documentos sem tag IBSCBS
  console.log('\nAuditando discrepância em dfe_itens para documentos sem RTC no XML:');
  const { data: sampleDocsSemRtc } = await supa
    .from('dfe_documentos')
    .select('id, chave_acesso, xml_raw')
    .not('xml_raw', 'is', null)
    .not('xml_raw', 'like', '%IBSCBS%')
    .limit(5);

  for (const d of (sampleDocsSemRtc || [])) {
    const { data: itensDoc } = await supa.from('dfe_itens').select('id, cclasstrib, valor_bruto_item, base_ibs, valor_ibs, base_cbs, valor_cbs').eq('documento_id', d.id);
    console.log(`Doc ${d.chave_acesso} (Sem IBSCBS no XML):`);
    for (const it of (itensDoc || [])) {
      console.log(`   Item ${it.id}: vProd=${it.valor_bruto_item} | base_ibs=${it.base_ibs} | valor_ibs=${it.valor_ibs} | cclasstrib=${it.cclasstrib}`);
    }
  }

  console.log('='.repeat(70));
}

runAudit();
