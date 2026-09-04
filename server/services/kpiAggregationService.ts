/**
 * ============================================================
 * SERVIÇO DE AGREGAÇÃO ESTATÍSTICA & KPIS FISCAIS
 * ============================================================
 * Executa somatórios agregados reais (SUM/COUNT) sem LIMIT,
 * desacoplando 100% os totalizadores da listagem visual.
 * 
 * Fornece:
 *  1. totalGeral: soma de 100% da base acumulada (sem corte de data)
 *  2. totalFiltrado: soma do intervalo de datas e filtros selecionados
 *  3. Base de Cálculo IBS/CBS (<vBC>) de acordo com a EC 132/23
 * ============================================================
 */

import { getDatabase } from '../db/database';
import { isSupabaseConfigured, getSupabaseAdmin } from '../db/supabase';
import { hotCache } from './hotCacheService';

export interface KpiTotals {
  totalDocs: number;
  totalValor: number;
  totalBaseCbs: number;
  totalBaseIbs: number;
  totalCbs: number;
  totalIbs: number;
  totalIbsUf: number;
  totalIbsMun: number;
  totalIvaDual: number;
  nfeCount: number;
  nfceCount: number;
  cteCount: number;
  nfseCount: number;
  totalIcms: number;
  totalPis: number;
  totalCofins: number;
  totalIpi: number;
  totalIrrf: number;
  totalInss: number;
  totalIss: number;

  // ── SIMULADOR DE TRANSIÇÃO (Reforma vs Atual) ──
  totalBaseLiquida: number;      // Base Líquida (vNF - todos tributos atuais reais/inferidos)
  totalRegimeAtual: number;      // Soma de todos os tributos atuais (ICMS + IPI + ISS + PIS + COFINS reais + inferidos)
  totalRegimeReforma: number;    // Total CBS + IBS simulados
  deltaTransicao: number;        // Reforma - Atual
  simplesNacDocsCount: number;   // Docs de emitentes CRT 1 ou 4 (Simples) com tributos inferidos
  cteInferidosCount: number;     // CT-e com PIS/COFINS inferidos
  icmsInferido: number;
  pisInferido: number;
  cofinsInferido: number;
  issInferido: number;
}

export interface KpiAggregateResult {
  totalGeral: KpiTotals;
  totalFiltrado: KpiTotals;
  source: 'hot-cache' | 'sqlite' | 'supabase';
  executionTimeMs: number;
}

export interface KpiFilterOptions {
  empresaId?: string;
  tenantCnpj?: string;
  dataInicio?: string;
  dataFim?: string;
  tipoDoc?: string;
  tipoOperacao?: string;
  isSuperadmin?: boolean;
}

interface ParamInferenciaItem {
  icms: number;
  pis: number;
  cofins: number;
  ipi: number;
  iss: number;
}

interface ParametrosInferenciaMap {
  sn: ParamInferenciaItem;
  cte: ParamInferenciaItem;
  nfse: ParamInferenciaItem;
}

function loadParametrosInferencia(): ParametrosInferenciaMap {
  const result: ParametrosInferenciaMap = {
    sn: { icms: 3.50, pis: 0.55, cofins: 2.56, ipi: 0.00, iss: 3.50 },
    cte: { icms: 0.00, pis: 1.65, cofins: 7.60, ipi: 0.00, iss: 0.00 },
    nfse: { icms: 0.00, pis: 0.65, cofins: 3.00, ipi: 0.00, iss: 5.00 },
  };

  try {
    const db = getDatabase();
    const rows = db.prepare('SELECT * FROM parametros_inferencia').all() as any[];
    for (const r of rows) {
      if (r.aplica_simples_nac) {
        result.sn.icms = Number(r.icms_medio) || result.sn.icms;
        result.sn.pis = Number(r.pis_medio) || result.sn.pis;
        result.sn.cofins = Number(r.cofins_medio) || result.sn.cofins;
        result.sn.iss = Number(r.iss_medio) || result.sn.iss;
      }
      if (r.aplica_cte) {
        result.cte.pis = Number(r.pis_medio) || result.cte.pis;
        result.cte.cofins = Number(r.cofins_medio) || result.cte.cofins;
      }
      if (r.aplica_nfse) {
        result.nfse.pis = Number(r.pis_medio) || result.nfse.pis;
        result.nfse.cofins = Number(r.cofins_medio) || result.nfse.cofins;
        result.nfse.iss = Number(r.iss_medio) || result.nfse.iss;
      }
    }
  } catch (err: any) {
    // fallback padrão já definido
  }

  return result;
}

function emptyTotals(): KpiTotals {
  return {
    totalDocs: 0,
    totalValor: 0,
    totalBaseCbs: 0,
    totalBaseIbs: 0,
    totalCbs: 0,
    totalIbs: 0,
    totalIbsUf: 0,
    totalIbsMun: 0,
    totalIvaDual: 0,
    nfeCount: 0,
    nfceCount: 0,
    cteCount: 0,
    nfseCount: 0,
    totalIcms: 0,
    totalPis: 0,
    totalCofins: 0,
    totalIpi: 0,
    totalIrrf: 0,
    totalInss: 0,
    totalIss: 0,

    totalBaseLiquida: 0,
    totalRegimeAtual: 0,
    totalRegimeReforma: 0,
    deltaTransicao: 0,
    simplesNacDocsCount: 0,
    cteInferidosCount: 0,
    icmsInferido: 0,
    pisInferido: 0,
    cofinsInferido: 0,
    issInferido: 0,
  };
}

function accumulateDoc(totals: KpiTotals, doc: any, paramsInf: ParametrosInferenciaMap) {
  const vTotal = Number(doc.valor_total) || 0;
  totals.totalDocs += 1;
  totals.totalValor += vTotal;

  // CBS Federal e IBS Estadual/Municipal (estritamente do XML)
  const vCbs = Number(doc.valor_cbs) || 0;
  const vIbs = Number(doc.valor_ibs) || 0;
  const vIbsUf = Number(doc.valor_ibs_uf) || 0;
  const vIbsMun = Number(doc.valor_ibs_mun) || 0;
  const totalIbsDoc = vIbs > 0 ? vIbs : (vIbsUf + vIbsMun);

  totals.totalCbs += vCbs;
  totals.totalIbsUf += vIbsUf;
  totals.totalIbsMun += vIbsMun;
  totals.totalIbs += totalIbsDoc;
  totals.totalIvaDual += (vCbs + totalIbsDoc);

  // Base de Cálculo IBS / CBS (<vBC> estritamente constante nos grupos IBS/CBS do XML)
  // Se o campo base_cbs/base_ibs estiver preenchido, usa ele.
  // Caso a coluna ainda não exista na tabela do Supabase, reconstrói fielmente a partir da alíquota teste do XML (0.9% CBS / 0.1% IBS)
  const baseCbs = Number(doc.base_cbs) > 0 ? Number(doc.base_cbs) : (vCbs > 0 ? Number((vCbs / 0.009).toFixed(2)) : 0);
  const baseIbs = Number(doc.base_ibs) > 0 ? Number(doc.base_ibs) : (totalIbsDoc > 0 ? Number((totalIbsDoc / 0.001).toFixed(2)) : 0);
  totals.totalBaseCbs += baseCbs;
  totals.totalBaseIbs += baseIbs;

  // Modelos de Documento
  const tipo = (doc.tipo_doc || '').toString().toUpperCase();
  if (tipo === 'NFE' || tipo === '55') totals.nfeCount += 1;
  else if (tipo === 'NFCE' || tipo === '65') totals.nfceCount += 1;
  else if (tipo === 'CTE' || tipo === '57') totals.cteCount += 1;
  else if (tipo === 'NFSE') totals.nfseCount += 1;

  // Tributos do Regime Atual Destacados no XML
  const icmsReal = Number(doc.valor_icms) || 0;
  const pisReal = Number(doc.valor_pis) || 0;
  const cofinsReal = Number(doc.valor_cofins) || 0;
  const ipiReal = Number(doc.valor_ipi) || 0;
  const irrfReal = Number(doc.valor_irrf) || 0;
  const inssReal = Number(doc.valor_inss) || 0;
  const issReal = Number(doc.valor_iss) || 0;

  totals.totalIcms += icmsReal;
  totals.totalPis += pisReal;
  totals.totalCofins += cofinsReal;
  totals.totalIpi += ipiReal;
  totals.totalIrrf += irrfReal;
  totals.totalInss += inssReal;
  totals.totalIss += issReal;

  // ── SIMULADOR DE TRANSIÇÃO (Reforma vs Atual) ──
  // Identificação de Simples Nacional (CRT 1 ou 4) e CT-e para aplicação de alíquotas médias
  const crt = String(doc.regime_tributario || doc.crt || '').trim();
  const isSimples = crt === '1' || crt === '4';
  const isCte = tipo === 'CTE' || tipo === '57';

  let icmsCalc = icmsReal;
  let pisCalc = pisReal;
  let cofinsCalc = cofinsReal;
  let ipiCalc = ipiReal;
  let issCalc = issReal;

  if (isSimples && icmsReal === 0 && pisReal === 0 && cofinsReal === 0) {
    // Simples Nacional: inferir alíquotas médias configuradas nos Parâmetros
    totals.simplesNacDocsCount += 1;
    const icmsInf = (vTotal * paramsInf.sn.icms) / 100;
    const pisInf = (vTotal * paramsInf.sn.pis) / 100;
    const cofinsInf = (vTotal * paramsInf.sn.cofins) / 100;
    const issInf = (tipo === 'NFSE') ? (vTotal * paramsInf.sn.iss) / 100 : 0;

    totals.icmsInferido += icmsInf;
    totals.pisInferido += pisInf;
    totals.cofinsInferido += cofinsInf;
    totals.issInferido += issInf;

    icmsCalc = icmsInf;
    pisCalc = pisInf;
    cofinsCalc = cofinsInf;
    issCalc = issInf;
  } else if (isCte && pisReal === 0 && cofinsReal === 0) {
    // CT-e: Não destaca PIS/COFINS. Inferir alíquota média de frete configurada nos Parâmetros
    totals.cteInferidosCount += 1;
    const pisInf = (vTotal * paramsInf.cte.pis) / 100;
    const cofinsInf = (vTotal * paramsInf.cte.cofins) / 100;

    totals.pisInferido += pisInf;
    totals.cofinsInferido += cofinsInf;

    pisCalc = pisInf;
    cofinsCalc = cofinsInf;
  }

  const tribTotal = icmsCalc + pisCalc + cofinsCalc + ipiCalc + issCalc;
  const baseLiquida = Math.max(0, vTotal - tribTotal);

  totals.totalBaseLiquida += baseLiquida;
  totals.totalRegimeAtual += tribTotal;

  // CBS e IBS simulados preliminarmente na alíquota de teste 2026 (0.9% CBS + 0.1% IBS)
  const cbsSimulada = (baseLiquida * 0.9) / 100;
  const ibsSimulada = (baseLiquida * 0.1) / 100;
  totals.totalRegimeReforma += (cbsSimulada + ibsSimulada);
  totals.deltaTransicao = totals.totalRegimeReforma - totals.totalRegimeAtual;
}

/**
 * Executa agregação fiscal desacoplada com Total Geral e Total Filtrado
 */
export async function getDecoupledKpiAggregates(filters: KpiFilterOptions): Promise<KpiAggregateResult> {
  const startTime = Date.now();
  const cacheKey = `kpi_aggregates_${filters.empresaId || 'all'}_${filters.tenantCnpj || 'all'}_${filters.dataInicio || 'all'}_${filters.dataFim || 'all'}_${filters.tipoDoc || 'all'}_${filters.tipoOperacao || 'all'}`;

  // 1. Checa Hot Cache em Memória
  const cached = hotCache.getHotData(cacheKey);
  if (cached) {
    return {
      totalGeral: cached.data.totalGeral,
      totalFiltrado: cached.data.totalFiltrado,
      source: 'hot-cache',
      executionTimeMs: Date.now() - startTime,
    };
  }

  const paramsInf = loadParametrosInferencia();

  // 2. Estratégia Supabase (quando configurado)
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        // Primeiro, obtém a contagem exata da base
        let baseCountQuery = supabase.from('dfe_documentos').select('*', { count: 'exact', head: true });
        if (filters.empresaId && !filters.isSuperadmin) {
          baseCountQuery = baseCountQuery.eq('empresa_id', filters.empresaId);
        }
        const { count: totalDocsSupabase, error: countErr } = await baseCountQuery;

        if (!countErr && totalDocsSupabase && totalDocsSupabase > 0) {
          const CHUNK_SIZE = 1000;
          const numChunks = Math.ceil(totalDocsSupabase / CHUNK_SIZE);
          const chunkPromises: Promise<any>[] = [];

          // Detecta se base_cbs já existe como coluna no Supabase
          let selectFields = 'id, empresa_id, tipo_doc, tipo_operacao, data_emissao, valor_total, valor_icms, valor_pis, valor_cofins, valor_cbs, valor_ibs, valor_is, valor_irrf, valor_inss, valor_iss, base_cbs, base_ibs, regime_tributario, cliente_cnpj, fornecedor_cnpj';
          const { error: testColErr } = await supabase.from('dfe_documentos').select('base_cbs').limit(0);
          if (testColErr) {
            selectFields = 'id, empresa_id, tipo_doc, tipo_operacao, data_emissao, valor_total, valor_icms, valor_pis, valor_cofins, valor_cbs, valor_ibs, valor_is, valor_irrf, valor_inss, valor_iss, cliente_cnpj, fornecedor_cnpj';
          }

          for (let i = 0; i < numChunks; i++) {
            const from = i * CHUNK_SIZE;
            const to = from + CHUNK_SIZE - 1;
            let chunkQuery = supabase
              .from('dfe_documentos')
              .select(selectFields)
              .range(from, to);

            chunkPromises.push(Promise.resolve(chunkQuery));
          }

          const results = await Promise.all(chunkPromises);
          const totalGeral = emptyTotals();
          const totalFiltrado = emptyTotals();

          const dataInicio = filters.dataInicio ? filters.dataInicio.substring(0, 10) : null;
          const dataFim = filters.dataFim ? filters.dataFim.substring(0, 10) : null;
          const tipoDoc = filters.tipoDoc && filters.tipoDoc !== 'TODOS' ? filters.tipoDoc.toUpperCase() : null;

          for (const res of results) {
            if (res.data) {
              for (const doc of res.data) {
                // Sempre acumula no Total Geral
                accumulateDoc(totalGeral, doc, paramsInf);

                // Aplica filtros para o Total Filtrado
                let pass = true;
                const docDate = (doc.data_emissao || '').substring(0, 10);
                if (dataInicio && docDate && docDate < dataInicio) pass = false;
                if (dataFim && docDate && docDate > dataFim) pass = false;
                if (tipoDoc) {
                  const dTipo = (doc.tipo_doc || '').toString().toUpperCase();
                  if (dTipo !== tipoDoc && !(tipoDoc === 'NFE' && dTipo === '55') && !(tipoDoc === 'NFCE' && dTipo === '65') && !(tipoDoc === 'CTE' && dTipo === '57')) {
                    pass = false;
                  }
                }
                if (filters.tipoOperacao && filters.tipoOperacao !== 'TODAS') {
                  const isEntrada = doc.tipo_operacao === 'Entrada';
                  if (filters.tipoOperacao === 'Entradas' && !isEntrada) pass = false;
                  if (filters.tipoOperacao === 'Saídas' && isEntrada) pass = false;
                }

                if (pass) {
                  accumulateDoc(totalFiltrado, doc, paramsInf);
                }
              }
            }
          }

          const result: KpiAggregateResult = {
            totalGeral,
            totalFiltrado,
            source: 'supabase',
            executionTimeMs: Date.now() - startTime,
          };

          // Grava no Hot Cache
          hotCache.setHotData(cacheKey, { totalGeral, totalFiltrado }, totalGeral.totalDocs);
          return result;
        }
      }
    } catch (supaErr: any) {
      console.warn('⚠️ Falha ao agregar via Supabase, usando SQLite:', supaErr?.message || supaErr);
    }
  }

  // 3. Fallback / Estratégia SQLite Local
  const db = getDatabase();
  const totalGeral = emptyTotals();
  const totalFiltrado = emptyTotals();

  try {
    let sql = `
      SELECT 
        id, empresa_id, tipo_doc, tipo_operacao, data_emissao,
        valor_total, valor_icms, valor_pis, valor_cofins, valor_ipi,
        valor_cbs, valor_ibs, valor_is, valor_irrf, valor_inss, valor_iss,
        base_cbs, base_ibs, regime_tributario, cliente_cnpj, fornecedor_cnpj
      FROM dfe_documentos
    `;
    const paramsSql: any[] = [];
    if (filters.empresaId && !filters.isSuperadmin) {
      sql += ' WHERE empresa_id = ?';
      paramsSql.push(filters.empresaId);
    }

    const rows = db.prepare(sql).all(...paramsSql) as any[];

    const dataInicio = filters.dataInicio ? filters.dataInicio.substring(0, 10) : null;
    const dataFim = filters.dataFim ? filters.dataFim.substring(0, 10) : null;
    const tipoDoc = filters.tipoDoc && filters.tipoDoc !== 'TODOS' ? filters.tipoDoc.toUpperCase() : null;

    for (const doc of rows) {
      accumulateDoc(totalGeral, doc, paramsInf);

      let pass = true;
      const docDate = (doc.data_emissao || '').substring(0, 10);
      if (dataInicio && docDate && docDate < dataInicio) pass = false;
      if (dataFim && docDate && docDate > dataFim) pass = false;
      if (tipoDoc) {
        const dTipo = (doc.tipo_doc || '').toString().toUpperCase();
        if (dTipo !== tipoDoc && !(tipoDoc === 'NFE' && dTipo === '55') && !(tipoDoc === 'NFCE' && dTipo === '65') && !(tipoDoc === 'CTE' && dTipo === '57')) {
          pass = false;
        }
      }
      if (filters.tipoOperacao && filters.tipoOperacao !== 'TODAS') {
        const isEntrada = doc.tipo_operacao === 'Entrada';
        if (filters.tipoOperacao === 'Entradas' && !isEntrada) pass = false;
        if (filters.tipoOperacao === 'Saídas' && isEntrada) pass = false;
      }

      if (pass) {
        accumulateDoc(totalFiltrado, doc, paramsInf);
      }
    }
  } catch (sqlErr: any) {
    console.warn('⚠️ Erro ao agregar via SQLite:', sqlErr.message);
  }

  hotCache.setHotData(cacheKey, { totalGeral, totalFiltrado }, totalGeral.totalDocs);

  return {
    totalGeral,
    totalFiltrado,
    source: 'sqlite',
    executionTimeMs: Date.now() - startTime,
  };
}
